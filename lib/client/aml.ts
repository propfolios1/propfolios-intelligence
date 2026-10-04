import "server-only";
import { desc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { scope } from "@/lib/tenant-db";

/**
 * Screening provider. "Nakhla Screening (mock)" screens against an internal
 * sample list with fuzzy name matching; it demonstrates the workflow and must
 * be replaced by a licensed provider (World-Check, Dow Jones, ComplyAdvantage)
 * before production use. The list is fictional.
 */
export const AML_PROVIDER = "Nakhla Screening (mock)";

export const SAMPLE_LIST: { list: string; type: "sanctions" | "pep" | "adverse_media"; name: string; note: string }[] = [
  { list: "Sample sanctions list (UN-format)", type: "sanctions", name: "Viktor Andreyevich Sokolov", note: "Asset freeze; arms procurement network." },
  { list: "Sample sanctions list (OFAC-format)", type: "sanctions", name: "Gulf Horizon General Trading FZE", note: "Designated entity; sanctions evasion." },
  { list: "Sample UAE local terrorist list", type: "sanctions", name: "Abdul Kareem Al Hashemi", note: "Local designation; financing." },
  { list: "Sample PEP register", type: "pep", name: "Khaled Bin Rashed Al Shamsi", note: "Former member of a municipal council (domestic PEP, left office 2021)." },
  { list: "Sample PEP register", type: "pep", name: "Rajesh Kumar Mehta", note: "Sitting member of a state legislative assembly (foreign PEP)." },
  { list: "Sample adverse media", type: "adverse_media", name: "Priya Sharma Kapoor", note: "Named in a 2019 press report on a property fraud complaint; complaint withdrawn." },
  { list: "Sample adverse media", type: "adverse_media", name: "Marcus Delacroix", note: "Convicted of mortgage fraud in 2016." },
];

const norm = (x: string) => x.toLowerCase().replace(/\b(al|el|bin|ibn|bint)\b/g, " ").replace(/[^a-z ]/g, " ").replace(/\s+/g, " ").trim();

/** Jaro-Winkler similarity on normalised names. */
export function jaroWinkler(a: string, b: string) {
  if (a === b) return 1;
  const md = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const am = new Array(a.length).fill(false);
  const bm = new Array(b.length).fill(false);
  let m = 0;
  for (let i = 0; i < a.length; i++)
    for (let j = Math.max(0, i - md); j < Math.min(b.length, i + md + 1); j++)
      if (!bm[j] && a[i] === b[j]) {
        am[i] = bm[j] = true;
        m++;
        break;
      }
  if (!m) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++)
    if (am[i]) {
      while (!bm[k]) k++;
      if (a[i] !== b[k]) t++;
      k++;
    }
  const jaro = (m / a.length + m / b.length + (m - t / 2) / m) / 3;
  let p = 0;
  while (p < 4 && a[p] === b[p]) p++;
  return jaro + p * 0.1 * (1 - jaro);
}

/** Name score: the better of whole-name similarity and token coverage (every token of the shorter name found in the longer). */
export function nameScore(a: string, b: string) {
  const na = norm(a);
  const nb = norm(b);
  const ta = na.split(" ");
  const tb = nb.split(" ");
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const covered = short.filter((t) => long.some((u) => jaroWinkler(t, u) >= 0.9)).length / short.length;
  return +Math.max(jaroWinkler(na, nb), covered * 0.95).toFixed(2);
}

export function screen(name: string, type: "sanctions" | "pep" | "adverse_media") {
  const hits = SAMPLE_LIST.filter((e) => e.type === type).map((e) => ({ list: e.list, name: e.name, score: nameScore(name, e.name), note: e.note })).filter((h) => h.score >= 0.85).sort((a, b) => b.score - a.score);
  return { status: hits.some((h) => h.score >= 0.98) ? ("confirmed_match" as const) : hits.length ? ("potential_match" as const) : ("clear" as const), flags: hits };
}

/** Runs sanctions, PEP and adverse media screening for a client and stores each result (valid twelve months). */
export async function runAmlScreening(db: DB, tenantId: string, clientId: string, at = new Date()) {
  const [c] = await db.select().from(s.clients).where(scope(s.clients, tenantId, eq(s.clients.id, clientId)));
  if (!c) throw new DomainError("Client not found.", 404);
  const out = [];
  for (const type of ["sanctions", "pep", "adverse_media"] as const) {
    const r = screen(c.name, type);
    const [row] = await db.insert(s.amlChecks).values({ tenantId, clientId, type, provider: AML_PROVIDER, status: r.status, flags: r.flags, checkedAt: at, expiresAt: new Date(at.getTime() + 365 * 86_400_000), createdAt: at }).returning();
    out.push(row!);
  }
  return out;
}

export async function latestAml(db: DB, tenantId: string, clientId: string) {
  const rows = await db.select().from(s.amlChecks).where(scope(s.amlChecks, tenantId, eq(s.amlChecks.clientId, clientId))).orderBy(desc(s.amlChecks.checkedAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latest.has(r.type)) latest.set(r.type, r);
  return { latest: [...latest.values()], history: rows };
}

/** Analyst disposition of a potential match: cleared (false positive) or confirmed. */
export async function reviewAml(db: DB, tenantId: string, checkId: string, d: { outcome: "clear" | "confirmed_match"; by: string }) {
  const [before] = await db.select().from(s.amlChecks).where(scope(s.amlChecks, tenantId, eq(s.amlChecks.id, checkId)));
  if (!before) throw new DomainError("Check not found.", 404);
  const [after] = await db.update(s.amlChecks).set({ status: d.outcome, reviewedBy: d.by }).where(eq(s.amlChecks.id, checkId)).returning();
  return { before, after: after! };
}
