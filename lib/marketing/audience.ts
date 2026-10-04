import "server-only";
import { and, gte, inArray, isNotNull, lte, or, type SQL, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { AudienceFilter } from "@/db/schema-production";
import { scope } from "@/lib/tenant-db";

/**
 * Audiences are filters over the firm's leads. Two conditions are always
 * applied and cannot be switched off: the lead consented to marketing, and the
 * lead is still open (not won or lost). WhatsApp sends additionally exclude
 * anyone who replied STOP.
 */

const DAY = 86_400_000;
const OPEN: ("new" | "contacted" | "qualified" | "viewing" | "offer")[] = ["new", "contacted", "qualified", "viewing", "offer"];

export function audienceWhere(tenantId: string, f: AudienceFilter, now = new Date()): SQL {
  const conds: (SQL | undefined)[] = [sql`${s.leads.consentMarketing} = true`, inArray(s.leads.stage, f.stages?.length ? OPEN.filter((x) => f.stages!.includes(x)) : OPEN)];
  if (f.intents?.length) conds.push(inArray(s.leads.intent, f.intents));
  if (f.sources?.length) conds.push(inArray(s.leads.source, f.sources));
  if (f.markets?.length) conds.push(inArray(s.leads.market, f.markets));
  if (f.locations?.length) conds.push(or(...f.locations.map((l) => sql`exists (select 1 from jsonb_array_elements_text(${s.leads.locations}) x where lower(x) = lower(${l}))`)));
  if (f.scoreMin) conds.push(gte(s.leads.score, f.scoreMin));
  // Budget overlap: the lead's range must reach the filter's range.
  if (f.budgetMin) conds.push(or(gte(s.leads.budgetMax, f.budgetMin), sql`${s.leads.budgetMax} is null`));
  if (f.budgetMax) conds.push(or(lte(s.leads.budgetMin, f.budgetMax), sql`${s.leads.budgetMin} is null`));
  if (f.createdWithinDays) conds.push(gte(s.leads.createdAt, new Date(now.getTime() - f.createdWithinDays * DAY)));
  if (f.noContactForDays) conds.push(or(sql`${s.leads.lastContactAt} is null`, lte(s.leads.lastContactAt, new Date(now.getTime() - f.noContactForDays * DAY))));
  if (f.require?.includes("email")) conds.push(isNotNull(s.leads.email));
  if (f.require?.includes("phone")) conds.push(isNotNull(s.leads.phone));
  return scope(s.leads, tenantId, and(...conds.filter(Boolean)))!;
}

export async function audienceMembers(db: DB, tenantId: string, f: AudienceFilter, opts: { limit?: number; now?: Date } = {}) {
  const q = db.select({ id: s.leads.id, name: s.leads.name, email: s.leads.email, phone: s.leads.phone, market: s.leads.market, intent: s.leads.intent, score: s.leads.score, ownerUserId: s.leads.ownerUserId, locations: s.leads.locations }).from(s.leads).where(audienceWhere(tenantId, f, opts.now)).orderBy(sql`${s.leads.score} desc`);
  return opts.limit ? q.limit(opts.limit) : q;
}

export async function audienceCount(db: DB, tenantId: string, f: AudienceFilter, now?: Date) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int`, email: sql<number>`count(${s.leads.email})::int`, phone: sql<number>`count(${s.leads.phone})::int` })
    .from(s.leads)
    .where(audienceWhere(tenantId, f, now));
  return r ?? { n: 0, email: 0, phone: 0 };
}

/** The audience for a listing: open leads with the matching intent whose budget reaches the price (within 15%) or who named the community. */
export function listingAudience(l: { purpose: "sale" | "rent"; price: number; community: string; market: string }): AudienceFilter {
  return { intents: l.purpose === "rent" ? ["rent"] : ["buy", "invest"], markets: [l.market], budgetMin: Math.round(l.price * 0.85), budgetMax: Math.round(l.price * 1.15) };
}

/* ------------------------------------------------------------ merge fields */

export const MERGE_FIELDS = ["first_name", "name", "agent_name", "firm", "listing_title", "listing_price", "listing_url", "community"] as const;

export function merge(text: string, v: Partial<Record<(typeof MERGE_FIELDS)[number], string>>) {
  return text.replace(/\{(first_name|name|agent_name|firm|listing_title|listing_price|listing_url|community)\}/g, (_, k: keyof typeof v) => v[k] ?? "");
}
