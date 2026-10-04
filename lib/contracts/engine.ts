/**
 * Contract template language. Small, safe and deterministic: no code runs,
 * expressions are parsed, and every value is HTML-escaped on output.
 *
 *   {{buyer.name}}                        a value
 *   {{price | money}}  {{date | long}}    a value through a filter
 *   {{#if buyer.isNri}} ... {{else}} ... {{/if}}
 *   {{#if price >= 5000000 && !cash}} ... {{/if}}
 *   {{#unless seller.company}} ... {{/unless}}
 *   {{#each conditions}}<li>{{this}}</li>{{/each}}   ({{@index}} is 1-based)
 *
 * Missing values render as a highlighted [placeholder] and are reported, so a
 * draft can be reviewed before anything is sent for signature.
 */

export type Ctx = Record<string, unknown>;

type Node =
  | { t: "text"; v: string }
  | { t: "var"; path: string; filters: string[] }
  | { t: "if"; expr: Expr; neg: boolean; then: Node[]; else: Node[] }
  | { t: "each"; path: string; body: Node[] };

type Expr =
  | { k: "lit"; v: unknown }
  | { k: "path"; p: string }
  | { k: "not"; e: Expr }
  | { k: "bin"; op: string; l: Expr; r: Expr };

export class TemplateError extends Error {
  constructor(
    message: string,
    public position: number,
  ) {
    super(message);
  }
}

/* --------------------------------------------------------------- parsing */

const TAG = /\{\{\s*([^}]*?)\s*\}\}/g;

export function parse(src: string): Node[] {
  const root: Node[] = [];
  const stack: { node: Extract<Node, { t: "if" } | { t: "each" }>; inElse: boolean; at: number }[] = [];
  const target = () => {
    const top = stack.at(-1);
    if (!top) return root;
    return top.node.t === "if" ? (top.inElse ? top.node.else : top.node.then) : top.node.body;
  };
  let last = 0;
  for (const m of src.matchAll(TAG)) {
    const at = m.index!;
    if (at > last) target().push({ t: "text", v: src.slice(last, at) });
    last = at + m[0].length;
    const tag = m[1]!;
    if (tag.startsWith("#if ") || tag.startsWith("#unless ")) {
      const neg = tag.startsWith("#unless ");
      const node = { t: "if" as const, expr: parseExpr(tag.slice(neg ? 8 : 4), at), neg, then: [] as Node[], else: [] as Node[] };
      target().push(node);
      stack.push({ node, inElse: false, at });
    } else if (tag.startsWith("#each ")) {
      const path = tag.slice(6).trim();
      if (!/^[\w.]+$/.test(path)) throw new TemplateError(`"#each" needs a list name, found "${path}"`, at);
      const node = { t: "each" as const, path, body: [] as Node[] };
      target().push(node);
      stack.push({ node, inElse: false, at });
    } else if (tag === "else") {
      const top = stack.at(-1);
      if (!top || top.node.t !== "if" || top.inElse) throw new TemplateError("{{else}} without an open {{#if}}", at);
      top.inElse = true;
    } else if (tag === "/if" || tag === "/unless" || tag === "/each") {
      const top = stack.pop();
      const want = tag === "/each" ? "each" : "if";
      if (!top || top.node.t !== want) throw new TemplateError(`${tag} does not close an open block`, at);
    } else if (tag.startsWith("#") || tag.startsWith("/")) {
      throw new TemplateError(`Unknown block "${tag}"`, at);
    } else {
      const [path, ...filters] = tag.split("|").map((x) => x.trim());
      if (!path || !/^(@index|this|[\w]+(\.[\w]+)*)$/.test(path)) throw new TemplateError(`Not a variable name: "${tag}"`, at);
      for (const f of filters) if (!FILTERS[f]) throw new TemplateError(`Unknown filter "${f}" (available: ${Object.keys(FILTERS).join(", ")})`, at);
      target().push({ t: "var", path, filters });
    }
  }
  if (stack.length) throw new TemplateError(`{{#${stack.at(-1)!.node.t}}} is not closed`, stack.at(-1)!.at);
  if (last < src.length) root.push({ t: "text", v: src.slice(last) });
  return root;
}

function parseExpr(src: string, at: number): Expr {
  const toks = src.match(/\s*(&&|\|\||==|!=|>=|<=|>|<|!|\(|\)|"[^"]*"|'[^']*'|-?\d+(?:\.\d+)?|true|false|null|[\w.]+)\s*/g)?.map((x) => x.trim()) ?? [];
  if (toks.join("").replace(/\s/g, "") !== src.replace(/\s/g, "")) throw new TemplateError(`Cannot read the condition "${src}"`, at);
  let i = 0;
  const peek = () => toks[i];
  const next = () => toks[i++];
  const prim = (): Expr => {
    const t = next();
    if (t === undefined) throw new TemplateError(`Incomplete condition "${src}"`, at);
    if (t === "!") return { k: "not", e: prim() };
    if (t === "(") {
      const e = or();
      if (next() !== ")") throw new TemplateError(`Missing ")" in "${src}"`, at);
      return e;
    }
    if (/^["']/.test(t)) return { k: "lit", v: t.slice(1, -1) };
    if (/^-?\d/.test(t)) return { k: "lit", v: Number(t) };
    if (t === "true" || t === "false") return { k: "lit", v: t === "true" };
    if (t === "null") return { k: "lit", v: null };
    if (/^[\w.]+$/.test(t)) return { k: "path", p: t };
    throw new TemplateError(`Unexpected "${t}" in "${src}"`, at);
  };
  const cmp = (): Expr => {
    const l = prim();
    if (["==", "!=", ">", "<", ">=", "<="].includes(peek() ?? "")) {
      const op = next()!;
      return { k: "bin", op, l, r: prim() };
    }
    return l;
  };
  const and = (): Expr => {
    let l = cmp();
    while (peek() === "&&") {
      next();
      l = { k: "bin", op: "&&", l, r: cmp() };
    }
    return l;
  };
  const or = (): Expr => {
    let l = and();
    while (peek() === "||") {
      next();
      l = { k: "bin", op: "||", l, r: and() };
    }
    return l;
  };
  const e = or();
  if (i < toks.length) throw new TemplateError(`Unexpected "${toks[i]}" in "${src}"`, at);
  return e;
}

/* ------------------------------------------------------------- evaluation */

export function lookup(ctx: Ctx, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), ctx);
}

function evalExpr(e: Expr, ctx: Ctx): unknown {
  switch (e.k) {
    case "lit":
      return e.v;
    case "path":
      return lookup(ctx, e.p);
    case "not":
      return !truthy(evalExpr(e.e, ctx));
    case "bin": {
      if (e.op === "&&") return truthy(evalExpr(e.l, ctx)) && truthy(evalExpr(e.r, ctx));
      if (e.op === "||") return truthy(evalExpr(e.l, ctx)) || truthy(evalExpr(e.r, ctx));
      const l = evalExpr(e.l, ctx);
      const r = evalExpr(e.r, ctx);
      switch (e.op) {
        case "==":
          return String(l ?? "") === String(r ?? "");
        case "!=":
          return String(l ?? "") !== String(r ?? "");
        case ">":
          return Number(l) > Number(r);
        case "<":
          return Number(l) < Number(r);
        case ">=":
          return Number(l) >= Number(r);
        case "<=":
          return Number(l) <= Number(r);
      }
    }
  }
  return undefined;
}

const truthy = (v: unknown) => (Array.isArray(v) ? v.length > 0 : Boolean(v) && v !== "false" && v !== "0");

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function words(n: number): string {
  if (n < 20) return ONES[n]!;
  if (n < 100) return TENS[Math.floor(n / 10)]! + (n % 10 ? `-${ONES[n % 10]}` : "");
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} hundred${n % 100 ? ` and ${words(n % 100)}` : ""}`;
  for (const [v, w] of [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]] as const) if (n >= v) return `${words(Math.floor(n / v))} ${w}${n % v ? `${n % v < 100 ? " and" : ""} ${words(n % v)}` : ""}`;
  return String(n);
}

/** Filters take the value and the whole context (for the currency). */
export const FILTERS: Record<string, (v: unknown, ctx: Ctx) => string> = {
  money: (v, ctx) => {
    const n = Number(v);
    const cur = String(lookup(ctx, "currency") ?? "");
    if (!Number.isFinite(n)) return String(v ?? "");
    return cur === "INR" ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `${cur} ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
  },
  words: (v) => {
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n < 0) return String(v ?? "");
    const w = n === 0 ? "zero" : words(n);
    return w.charAt(0).toUpperCase() + w.slice(1);
  },
  long: (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ""));
    return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : String(v ?? "");
  },
  upper: (v) => String(v ?? "").toUpperCase(),
  pct: (v) => `${Number(v)}%`,
  number: (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString("en-US") : String(v ?? "")),
};

export interface RenderResult {
  html: string;
  missing: string[];
  used: string[];
}

export function render(src: string | Node[], ctx: Ctx): RenderResult {
  const nodes = typeof src === "string" ? parse(src) : src;
  const missing = new Set<string>();
  const used = new Set<string>();
  const walk = (ns: Node[], c: Ctx): string =>
    ns
      .map((n) => {
        if (n.t === "text") return n.v;
        if (n.t === "var") {
          used.add(n.path);
          const v = lookup(c, n.path);
          if (v === undefined || v === null || v === "") {
            missing.add(n.path);
            return `<mark class="missing">[${escapeHtml(n.path)}]</mark>`;
          }
          return escapeHtml(n.filters.reduce<string>((acc, f, i) => FILTERS[f]!(i === 0 ? v : acc, c), String(v)));
        }
        if (n.t === "if") {
          const yes = truthy(evalExpr(n.expr, c));
          return walk(yes !== n.neg ? n.then : n.else, c);
        }
        const list = lookup(c, n.path);
        used.add(n.path);
        if (!Array.isArray(list)) return "";
        return list.map((item, i) => walk(n.body, { ...c, this: item, "@index": i + 1, ...(item && typeof item === "object" ? (item as Ctx) : {}) })).join("");
      })
      .join("");
  return { html: walk(nodes, ctx), missing: [...missing].filter((m) => m !== "this" && m !== "@index"), used: [...used] };
}

/** Every variable path a template refers to, in order of first use. */
export function variablesOf(src: string): string[] {
  const out: string[] = [];
  const add = (p: string) => !out.includes(p) && p !== "this" && p !== "@index" && out.push(p);
  const walk = (ns: Node[]) => {
    for (const n of ns) {
      if (n.t === "var") add(n.path);
      else if (n.t === "each") {
        add(n.path);
      } else if (n.t === "if") {
        const paths = (e: Expr): void => {
          if (e.k === "path") add(e.p);
          if (e.k === "not") paths(e.e);
          if (e.k === "bin") {
            paths(e.l);
            paths(e.r);
          }
        };
        paths(n.expr);
        walk(n.then);
        walk(n.else);
      }
    }
  };
  walk(parse(src));
  return out;
}
