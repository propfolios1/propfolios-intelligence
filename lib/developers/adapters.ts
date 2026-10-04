import type { InventoryMapping } from "@/db/schema-production";
import { csvRecords } from "@/lib/migration/csv";
import { profileFor } from "@/lib/trial/profiles";

/**
 * Reading a developer's inventory. Feeds arrive as CSV, JSON or XML with the
 * developer's own column names; headers are matched to the canonical fields by
 * common spellings, and the firm can override any field. Every unit is
 * normalised to one shape before it is compared with what was there before.
 */

export type Unit = {
  unitRef: string;
  project: string;
  building: string | null;
  unitType: string | null;
  bedrooms: number | null;
  areaSqft: number | null;
  price: number | null;
  currency: string;
  status: "available" | "reserved" | "sold" | "withdrawn";
  floor: string | null;
  view: string | null;
  handover: string | null;
  paymentPlan: string | null;
  raw: Record<string, unknown>;
};

const SYNONYMS: Record<keyof InventoryMapping, string[]> = {
  unitRef: ["unit", "unit no", "unit number", "unit_no", "unitnumber", "unit ref", "unit_ref", "unit id", "unitid", "flat no", "apartment no", "property id", "sku"],
  project: ["project", "project name", "development", "community project", "tower project"],
  building: ["building", "tower", "block", "wing", "phase"],
  unitType: ["type", "unit type", "property type", "category", "configuration"],
  bedrooms: ["bedrooms", "beds", "bed", "br", "bhk", "no of bedrooms"],
  areaSqft: ["area", "area sqft", "area sq ft", "size", "sqft", "saleable area", "total area", "bua", "built up area", "carpet area sqft"],
  price: ["price", "selling price", "list price", "total price", "price aed", "price inr", "amount", "agreement value"],
  currency: ["currency", "ccy"],
  status: ["status", "availability", "inventory status", "unit status"],
  floor: ["floor", "level", "floor no"],
  view: ["view", "views", "facing"],
  handover: ["handover", "completion", "possession", "handover date", "possession date", "completion date"],
  paymentPlan: ["payment plan", "plan", "payment terms"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Header for each canonical field: an explicit mapping first, then the first header matching a common spelling. */
export function autoMap(headers: string[], override: InventoryMapping = {}): InventoryMapping {
  const out: InventoryMapping = {};
  const byNorm = new Map(headers.map((h) => [norm(h), h]));
  for (const f of Object.keys(SYNONYMS) as (keyof InventoryMapping)[]) {
    if (override[f] && headers.includes(override[f]!)) out[f] = override[f];
    else {
      const hit = SYNONYMS[f].map(norm).find((s) => byNorm.has(s));
      if (hit) out[f] = byNorm.get(hit);
    }
  }
  return out;
}

const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/[^\d.-]/g, "");
  const n = Number(s);
  return s && Number.isFinite(n) ? n : null;
};

export function normaliseStatus(v: unknown): Unit["status"] {
  const s = String(v ?? "").toLowerCase();
  if (/sold|registered|spa signed|booked out/.test(s)) return "sold";
  if (/reserv|hold|block|booked|on hold|eoi/.test(s)) return "reserved";
  if (/withdraw|unavailable|inactive|not for sale/.test(s)) return "withdrawn";
  return "available";
}

export function toUnits(records: Record<string, unknown>[], mapping: InventoryMapping, defaults: { currency: string; project: string }): { units: Unit[]; rejected: number } {
  const units: Unit[] = [];
  let rejected = 0;
  const get = (r: Record<string, unknown>, f: keyof InventoryMapping) => (mapping[f] ? r[mapping[f]!] : undefined);
  const seen = new Set<string>();
  for (const r of records) {
    const ref = String(get(r, "unitRef") ?? "").trim();
    if (!ref || seen.has(ref)) {
      rejected++;
      continue;
    }
    seen.add(ref);
    const beds = get(r, "bedrooms");
    units.push({
      unitRef: ref,
      project: String(get(r, "project") ?? defaults.project).trim() || defaults.project,
      building: (get(r, "building") as string | undefined)?.toString().trim() || null,
      unitType: (get(r, "unitType") as string | undefined)?.toString().trim() || null,
      bedrooms: /studio/i.test(String(beds ?? get(r, "unitType") ?? "")) ? 0 : num(beds),
      areaSqft: num(get(r, "areaSqft")),
      price: num(get(r, "price")),
      currency: String(get(r, "currency") ?? defaults.currency).trim().toUpperCase().slice(0, 3) || defaults.currency,
      status: normaliseStatus(get(r, "status")),
      floor: (get(r, "floor") as string | undefined)?.toString() || null,
      view: (get(r, "view") as string | undefined)?.toString() || null,
      handover: (get(r, "handover") as string | undefined)?.toString() || null,
      paymentPlan: (get(r, "paymentPlan") as string | undefined)?.toString() || null,
      raw: r,
    });
  }
  return { units, rejected };
}

/** Flat records from a feed body, whatever its format. */
export function recordsFrom(body: string, format: "csv" | "json" | "xml"): Record<string, unknown>[] {
  if (format === "csv") return csvRecords(body).records;
  if (format === "json") {
    const j = JSON.parse(body) as unknown;
    const arr = Array.isArray(j) ? j : ((j as Record<string, unknown>).units ?? (j as Record<string, unknown>).inventory ?? (j as Record<string, unknown>).data ?? (j as Record<string, unknown>).items);
    if (!Array.isArray(arr)) throw new Error("The JSON has no list of units (expected an array, or units, inventory, data or items).");
    return arr.filter((x): x is Record<string, unknown> => !!x && typeof x === "object");
  }
  // XML: each <unit> (or <property>, <item>) element's child elements become fields.
  const tag = ["unit", "property", "item", "listing"].find((t) => new RegExp(`<${t}[\\s>]`, "i").test(body));
  if (!tag) throw new Error("The XML has no <unit>, <property>, <item> or <listing> elements.");
  const out: Record<string, unknown>[] = [];
  for (const m of body.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "gi"))) {
    const rec: Record<string, unknown> = {};
    for (const a of (m[1] ?? "").matchAll(/(\w+)="([^"]*)"/g)) rec[a[1]!] = a[2];
    for (const f of m[2]!.matchAll(/<(\w+)[^>]*>([\s\S]*?)<\/\1>/g)) rec[f[1]!] = f[2]!.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
    out.push(rec);
  }
  return out;
}

/* ---------------------------------------------------------------- sandbox */

function rng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
const ANCHOR = Math.floor(Date.UTC(2026, 8, 1) / 86_400_000);
const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/**
 * A deterministic sandbox feed: the developer's projects from the market
 * profile, with units that sell, reserve and reprice a little from one day to
 * the next, so change detection can be seen working without a live feed.
 */
export function sandboxFeed(developerKey: string, developerName: string, market: "AE" | "IN", at: Date): Record<string, unknown>[] {
  const p = profileFor(market);
  const projects = p.projects.filter((x) => x.dev === developerKey).slice(0, 3);
  const list = projects.length ? projects : [{ name: `${developerName.split(" ")[0]} Residences`, ppsf: market === "IN" ? 32_000 : 1_900, handover: "Q4 2027", community: p.communities[0]?.community ?? "City Centre" }];
  const day = Math.floor(at.getTime() / 86_400_000);
  const out: Record<string, unknown>[] = [];
  for (const pr of list) {
    const base = rng(hash(`${developerKey}:${pr.name}`));
    for (let i = 0; i < 12; i++) {
      const beds = Math.floor(base() * 4);
      const area = Math.round((beds === 0 ? 450 : 650 + beds * 420) * (0.9 + base() * 0.25));
      const floor = 3 + Math.floor(base() * 40);
      const ref = `${pr.name.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}-${floor}${String(i + 1).padStart(2, "0")}`;
      const daily = rng(hash(`${ref}:${day}`));
      const weekly = rng(hash(`${ref}:${Math.floor(day / 7)}`));
      // Each unit sells on a fixed day after the sandbox anchor, so the inventory thins out over time.
      const sellsOn = ANCHOR + 10 + Math.floor(base() * 120);
      const status = day >= sellsOn ? "Sold" : daily() < 0.08 ? "On hold" : "Available";
      const price = Math.round((area * (pr.ppsf ?? 1_800) * (1 + floor * 0.004)) * (1 + (weekly() - 0.5) * 0.04) / 1000) * 1000;
      out.push({ "Unit No": ref, Project: pr.name, Tower: `Tower ${1 + (i % 2)}`, Type: beds === 0 ? "Studio" : `${beds} Bedroom`, Bedrooms: beds, "Area (sq ft)": area, Price: price, Currency: p.currency, Status: status, Floor: floor, View: ["Community", "Pool", "Skyline", "Sea"][Math.floor(base() * 4)], Handover: pr.handover, "Payment Plan": market === "IN" ? "Construction-linked" : "60/40" });
    }
  }
  return out;
}
