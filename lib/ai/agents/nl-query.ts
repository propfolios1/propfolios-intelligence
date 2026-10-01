import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { anthropic, isAiConfigured, MODELS, recordAgentRun, toolSchema } from "../client";
import { addUsage, costUsd, emptyUsage } from "../cost";
import { NL_QUERY_PROMPT_VERSION, nlQuerySystem } from "../prompts/nl-query_v1";
import { runDataTool, toolsFor, type Source, type ToolScope } from "../tools/data";

/** Events streamed to the browser as newline-delimited JSON. */
export type AssistantEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string }
  | { type: "sources"; sources: Source[] }
  | { type: "done"; costUsd: number; model: string }
  | { type: "error"; message: string };

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const TOOL_LABEL: Record<string, string> = {
  list_clients: "Reading the client register",
  list_holdings: "Reading holdings",
  get_alerts: "Checking alerts",
  get_recommendations: "Reading recommendations",
  list_mandates: "Reading mandates",
  search_properties: "Searching the catalogue",
  get_market: "Reading market data",
  search_documents: "Searching documents",
};

const MAX_ROUNDS = 6;

/**
 * Natural-language query agent. A streaming tool-use loop over read-only,
 * tenant-scoped data tools; each tool result carries numbered sources the
 * answer cites as [n]. Without an API key a rule-based router answers from
 * the same tools so the assistant remains usable.
 */
export function nlQuery(opts: { scope: ToolScope; clientName: string; history: ChatTurn[]; question: string; actor: string; signal?: AbortSignal }): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (e: AssistantEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        if (isAiConfigured()) await live(opts, send);
        else await replay(opts, send);
      } catch (err) {
        send({ type: "error", message: (err as Error).message || "The assistant could not complete this request." });
      } finally {
        controller.close();
      }
    },
  });
}

async function live(opts: Parameters<typeof nlQuery>[0], send: (e: AssistantEvent) => void) {
  const model = MODELS.fast;
  const tools: Anthropic.Tool[] = toolsFor(opts.scope).map((t) => ({ name: t.name, description: t.description, input_schema: toolSchema(t.input as z.ZodType) }));
  const messages: Anthropic.MessageParam[] = [...opts.history.slice(-10).map((t) => ({ role: t.role, content: t.content })), { role: "user", content: opts.question }];
  const system: Anthropic.TextBlockParam[] = [{ type: "text", text: nlQuerySystem(opts.clientName, opts.scope.staff), cache_control: { type: "ephemeral" } }];
  const sources: Source[] = [];
  let usage = emptyUsage();
  const started = Date.now();

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = anthropic().messages.stream({ model, max_tokens: 2048, system, tools, messages }, { signal: opts.signal });
    stream.on("text", (delta) => send({ type: "text", delta }));
    const msg = await stream.finalMessage();
    usage = addUsage(usage, msg.usage);
    if (msg.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: msg.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of msg.content) {
      if (block.type !== "tool_use") continue;
      send({ type: "tool", name: block.name, label: TOOL_LABEL[block.name] ?? block.name });
      const r = await runDataTool(opts.scope, block.name, block.input);
      const numbered = r.sources.map((s) => {
        const existing = sources.find((x) => x.href === s.href && x.title === s.title);
        if (existing) return existing;
        const n = { n: sources.length + 1, ...s };
        sources.push(n);
        return n;
      });
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify({ sources: numbered.map((s) => ({ n: s.n, title: s.title })), data: r.data }) });
    }
    messages.push({ role: "user", content: results });
  }

  if (sources.length) send({ type: "sources", sources });
  const cost = costUsd(model, usage);
  await recordAgentRun({ tenantId: opts.scope.tenantId, actor: opts.actor }, "nl-query", `assistant answer (${NL_QUERY_PROMPT_VERSION})`, { model, usage, costUsd: cost, durationMs: Date.now() - started }, { question: opts.question.slice(0, 200) });
  send({ type: "done", costUsd: cost, model });
}

/* ------------------------------------------------------------------ replay */

const fmtAed = (v: number) => (v >= 1_000_000 ? `AED ${(v / 1_000_000).toFixed(2)}M` : `AED ${Math.round(v / 1000)}K`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Plan = { tool: string; input: Record<string, unknown> };

function route(q: string, scope: ToolScope, clientName: string): Plan[] {
  const t = q.toLowerCase();
  const named = scope.staff ? (["ahmed", "priya", "khalid", "rajesh", "fatima"].find((n) => t.includes(n)) ?? null) : null;
  const who = { clientName: named };
  const plans: Plan[] = [];
  if (/alert|attention|risk|issue|concern|watch/.test(t)) plans.push({ tool: "get_alerts", input: who });
  if (/recommend|should i|exit|sell|rebalanc|opportunit|next/.test(t)) plans.push({ tool: "get_recommendations", input: who });
  if (/market|dubai|abu dhabi|sharjah|ras al khaimah|price|transaction|yield in/.test(t) && !/my /.test(t)) {
    const region = ["abu dhabi", "sharjah", "ras al khaimah"].find((r) => t.includes(r)) ?? "dubai";
    plans.push({ tool: "get_market", input: { region } });
  }
  if (/mandate|pipeline|memo|committee/.test(t)) plans.push({ tool: "list_mandates", input: {} });
  if (/propert(y|ies)|project|launch|off-plan|off plan|catalogue|india|mumbai|bengaluru|gurugram|pune/.test(t) && !/my /.test(t)) {
    plans.push({ tool: "search_properties", input: { market: /india|mumbai|bengaluru|gurugram|pune/.test(t) ? "India" : /uae|dubai|abu dhabi/.test(t) ? "UAE" : null, status: /off-plan|off plan/.test(t) ? "off_plan" : null } });
  }
  if (/document|spa|agreement|title deed|statement|report|valuation/.test(t)) plans.push({ tool: "search_documents", input: { query: q } });
  if (/client/.test(t) && scope.staff && !named) plans.push({ tool: "list_clients", input: {} });
  if (!plans.length || /portfolio|holding|worth|value|income|rent|irr|return|perform|concentrat|my /.test(t)) {
    if (scope.staff && !named) plans.unshift({ tool: "list_clients", input: {} });
    else plans.unshift({ tool: "list_holdings", input: who });
  }
  void clientName;
  return plans.slice(0, 3);
}

function compose(tool: string, data: unknown, n: number): string {
  const cite = `[${n}]`;
  const d = data as Record<string, unknown>;
  if (d && typeof d === "object" && "error" in d) return `${String(d.error)}`;
  switch (tool) {
    case "list_holdings": {
      const h = d as { totalValueAed: number; totalCostAed: number; annualRentAed: number; holdings: { property: string; valueAed: number; irrPct: number; cashYieldPct: number; sharePct: number; status: string }[] };
      if (!h.holdings.length) return `There are no holdings on record ${cite}.`;
      const gain = ((h.totalValueAed - h.totalCostAed) / h.totalCostAed) * 100;
      const top = [...h.holdings].sort((a, b) => b.irrPct - a.irrPct)[0]!;
      const big = [...h.holdings].sort((a, b) => b.sharePct - a.sharePct)[0]!;
      const watch = h.holdings.filter((x) => x.status === "watch");
      return `The portfolio is valued at ${fmtAed(h.totalValueAed)} across ${h.holdings.length} holdings, ${gain.toFixed(1)}% above cost, with annual rent of ${fmtAed(h.annualRentAed)} ${cite}. The strongest performer is ${top.property} at an IRR of ${top.irrPct.toFixed(1)}% since acquisition; the largest position is ${big.property} at ${big.sharePct.toFixed(1)}% of value ${cite}.${watch.length ? ` ${watch.map((w) => w.property).join(" and ")} ${watch.length > 1 ? "are" : "is"} on the watch list.` : ""}`;
    }
    case "list_clients": {
      const rows = data as { name: string; aumAed: number; residency: string; riskProfile: string }[];
      return `The firm advises ${rows.length} clients with combined AUM of ${fmtAed(rows.reduce((a, r) => a + r.aumAed, 0))} ${cite}. The largest relationship is ${rows[0]?.name} at ${fmtAed(rows[0]?.aumAed ?? 0)}. Name a client to see their holdings.`;
    }
    case "get_alerts": {
      const rows = data as { client: string; severity: string; title: string; detail: string }[];
      if (!rows.length) return `There are no open alerts ${cite}.`;
      const top = rows.filter((r) => r.severity === "HIGH" || r.severity === "CRITICAL");
      return `${rows.length} recent alerts${top.length ? `, ${top.length} rated high` : ""} ${cite}. ${rows
        .slice(0, 3)
        .map((r) => `${r.title}: ${r.detail}`)
        .join(" ")}`;
    }
    case "get_recommendations": {
      const rows = data as { title: string; message: string }[];
      if (!rows.length) return `There are no open recommendations ${cite}.`;
      return `${rows.length} open recommendation${rows.length > 1 ? "s" : ""} ${cite}. The first priority is ${rows[0]!.title.toLowerCase()}: ${rows[0]!.message}`;
    }
    case "get_market": {
      const m = d as { region: string; transactions: number; medianPriceSqftAed: number; priceChange12mPct: number; offPlanSharePct: number; grossRentalYieldPct: number };
      return `${m.region} recorded ${m.transactions.toLocaleString("en-US")} transactions in the latest month at a median AED ${Math.round(m.medianPriceSqftAed).toLocaleString("en-US")} per sq ft, ${m.priceChange12mPct >= 0 ? "up" : "down"} ${Math.abs(m.priceChange12mPct).toFixed(1)}% over twelve months ${cite}. Off-plan accounted for ${m.offPlanSharePct.toFixed(1)}% of sales and gross rental yields average ${m.grossRentalYieldPct.toFixed(1)}% ${cite}.`;
    }
    case "list_mandates": {
      const rows = data as { reference: string; title: string; status: string; recommendation: string | null }[];
      if (!rows.length) return `There are no mandates on record ${cite}.`;
      return `${rows.length} mandates on record ${cite}: ${rows
        .slice(0, 4)
        .map((r) => `${r.reference} ${r.title} (${r.status.replace("_", " ").toLowerCase()}${r.recommendation ? `, ${r.recommendation.toLowerCase()}` : ""})`)
        .join("; ")}.`;
    }
    case "search_properties": {
      const rows = data as { name: string; community: string; currency: string; priceMin: number; grossYieldPct: number; status: string }[];
      if (!rows.length) return `No catalogue properties match ${cite}.`;
      return `${rows.length} properties match, ranked by gross yield ${cite}. ${rows
        .slice(0, 3)
        .map((r) => `${r.name} in ${r.community} from ${r.currency === "INR" ? `INR ${(r.priceMin / 1e7).toFixed(2)} Cr` : fmtAed(r.priceMin)} at ${r.grossYieldPct.toFixed(1)}% gross`)
        .join("; ")}.`;
    }
    case "search_documents": {
      const rows = data as { title: string; excerpt: string }[];
      if (!rows.length) return `No documents match ${cite}.`;
      const first = rows[0]!.excerpt.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return `The most relevant document is ${rows[0]!.title} ${cite}. ${first.slice(0, 280)}${first.length > 280 ? "…" : ""}`;
    }
  }
  return "";
}

async function replay(opts: Parameters<typeof nlQuery>[0], send: (e: AssistantEvent) => void) {
  const sources: Source[] = [];
  const paragraphs: string[] = [];
  for (const plan of route(opts.question, opts.scope, opts.clientName)) {
    if (!opts.scope.staff && plan.tool === "list_clients") continue;
    send({ type: "tool", name: plan.tool, label: TOOL_LABEL[plan.tool] ?? plan.tool });
    await sleep(350);
    const r = await runDataTool(opts.scope, plan.tool, plan.input);
    const n = sources.length + 1;
    r.sources.forEach((s, i) => sources.push({ n: n + i, ...s }));
    const text = compose(plan.tool, r.data, n);
    if (text) paragraphs.push(text);
  }
  if (!paragraphs.length) paragraphs.push("I could not find data that answers this question. Your relationship manager can help.");
  const answer = paragraphs.join("\n\n");
  for (const chunk of answer.match(/\S+\s*/g) ?? []) {
    send({ type: "text", delta: chunk });
    await sleep(14);
  }
  if (sources.length) send({ type: "sources", sources });
  await recordAgentRun({ tenantId: opts.scope.tenantId, actor: opts.actor }, "nl-query", `assistant answer (${NL_QUERY_PROMPT_VERSION})`, { model: "replay", usage: emptyUsage(), costUsd: 0, durationMs: 0 }, { question: opts.question.slice(0, 200), replay: true });
  send({ type: "done", costUsd: 0, model: "replay" });
}
