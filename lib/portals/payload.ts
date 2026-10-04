import { createHash } from "node:crypto";
import type { FieldRule, ListingSource } from "./specs";

/**
 * Builds a portal payload from a listing through a field map. Targets are
 * dotted paths ("property.address.town", "detailed_description.0.text"); a
 * numeric segment creates an array. Value maps translate Nakhla values into
 * the portal's codes. Pure, so every portal's mapping is testable.
 */

export type ListingContext = {
  reference: string;
  title: string;
  description: string;
  purpose: "sale" | "rent";
  propertyType: string;
  price: number;
  currency: string;
  city: string;
  community: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number;
  areaUnit: "sqft" | "sqm";
  permitNumber: string | null;
  photos: { url: string; caption: string }[];
  agentName: string | null;
  agentEmail: string | null;
  agentPhone: string | null;
  rentPeriod: "monthly" | "annual" | null;
  status: string;
  listedAt: Date | null;
  features: string[];
  branchId: string | null;
  networkId: string | null;
};

function read(l: ListingContext, source: ListingSource, rule: FieldRule): unknown {
  switch (source) {
    case "const":
      return rule.value ?? null;
    case "area":
      return l.areaUnit === "sqm" ? Math.round(l.area * 10.7639) : Math.round(l.area);
    case "areaSqm":
      return l.areaUnit === "sqm" ? Math.round(l.area) : Math.round(l.area / 10.7639);
    case "photoUrls":
      return l.photos.map((p) => p.url);
    case "photoObjects":
      return l.photos.map((p, i) => ({ url: p.url, caption: p.caption, type: "image", order: i + 1 }));
    case "listedAt":
      return l.listedAt ? l.listedAt.toISOString() : null;
    default:
      return (l as Record<string, unknown>)[source] ?? null;
  }
}

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cur: Record<string, unknown> | unknown[] = obj;
  parts.forEach((p, i) => {
    const last = i === parts.length - 1;
    const key: string | number = /^\d+$/.test(p) ? Number(p) : p;
    const nextIsIndex = !last && /^\d+$/.test(parts[i + 1]!);
    const holder = cur as Record<string | number, unknown>;
    if (last) holder[key] = value;
    else {
      if (holder[key] === undefined || holder[key] === null) holder[key] = nextIsIndex ? [] : {};
      cur = holder[key] as Record<string, unknown>;
    }
  });
}

export type BuildOutcome = { ok: true; payload: Record<string, unknown>; hash: string } | { ok: false; missing: string[] };

export function buildPayload(rules: FieldRule[], l: ListingContext): BuildOutcome {
  const payload: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const r of rules) {
    let v = read(l, r.source, r);
    if (r.map && v !== null && v !== undefined) v = r.map[String(v)] ?? (r.required ? null : v);
    const empty = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (r.required) missing.push(r.target);
      continue;
    }
    setPath(payload, r.target, v);
  }
  if (missing.length) return { ok: false, missing };
  return { ok: true, payload, hash: createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 32) };
}

/** Portal status vocabulary onto Nakhla's. */
export function normaliseStatus(raw: unknown): "live" | "publishing" | "rejected" | "removed" | null {
  const v = String(raw ?? "").toLowerCase();
  if (!v) return null;
  if (/(live|publish|active|online|approved|available)/.test(v)) return "live";
  if (/(pend|review|process|queue|moderat|draft)/.test(v)) return "publishing";
  if (/(reject|fail|invalid|declin|error)/.test(v)) return "rejected";
  if (/(delet|remov|archiv|expir|offline|withdraw)/.test(v)) return "removed";
  return null;
}

/** First defined value among dotted paths in a response. */
export function pick(obj: unknown, paths: string[]): unknown {
  for (const p of paths) {
    let cur: unknown = obj;
    for (const part of p.split(".")) cur = cur && typeof cur === "object" ? (cur as Record<string, unknown>)[part] : undefined;
    if (cur !== undefined && cur !== null && cur !== "") return cur;
  }
  return undefined;
}
