import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { LeadIntent, LeadStage, LeadTimeline } from "@/db/schema-brokerage";
import { HttpError } from "@/lib/auth";
import { marketOf, PORTAL_INDEX, SOURCE_NAME } from "@/lib/markets";
import { scope } from "@/lib/tenant-db";
import { scoreLead } from "./scoring";

const DAY = 86_400_000;

export const STAGE_LABEL: Record<LeadStage, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", viewing: "Viewing", offer: "Offer", won: "Won", lost: "Lost" };

export async function listLeads(db: DB, tenantId: string) {
  return db
    .select({ lead: s.leads, owner: s.users.name, listing: s.listings.title })
    .from(s.leads)
    .leftJoin(s.users, eq(s.users.id, s.leads.ownerUserId))
    .leftJoin(s.listings, eq(s.listings.id, s.leads.listingId))
    .where(scope(s.leads, tenantId))
    .orderBy(desc(s.leads.score), desc(s.leads.createdAt));
}

/** Average hours from arrival to the first call, WhatsApp, email or viewing, over leads that have one. */
export async function firstResponseHours(db: DB, tenantId: string) {
  const first = db
    .select({ leadId: s.leadActivities.leadId, firstAt: sql<Date>`min(${s.leadActivities.occurredAt})`.as("first_at") })
    .from(s.leadActivities)
    .where(scope(s.leadActivities, tenantId, sql`${s.leadActivities.type} in ('call','whatsapp','email','viewing')`))
    .groupBy(s.leadActivities.leadId)
    .as("f");
  const [r] = await db
    .select({ h: sql<number | null>`avg(extract(epoch from (${first.firstAt} - ${s.leads.createdAt})) / 3600)::float8` })
    .from(s.leads)
    .innerJoin(first, eq(first.leadId, s.leads.id))
    .where(scope(s.leads, tenantId, sql`${first.firstAt} >= ${s.leads.createdAt}`));
  return r?.h ?? null;
}

export async function getLead(db: DB, tenantId: string, id: string) {
  const [row] = await db
    .select({ lead: s.leads, owner: s.users.name, listing: s.listings })
    .from(s.leads)
    .leftJoin(s.users, eq(s.users.id, s.leads.ownerUserId))
    .leftJoin(s.listings, eq(s.listings.id, s.leads.listingId))
    .where(scope(s.leads, tenantId, eq(s.leads.id, id)));
  if (!row) return null;
  const activities = await db
    .select({ a: s.leadActivities, user: s.users.name })
    .from(s.leadActivities)
    .leftJoin(s.users, eq(s.users.id, s.leadActivities.userId))
    .where(scope(s.leadActivities, tenantId, eq(s.leadActivities.leadId, id)))
    .orderBy(desc(s.leadActivities.occurredAt));
  return { ...row, activities };
}

/** Recomputes the score from the lead, its listing and the last fourteen days of activity. */
export async function rescore(db: DB, tenantId: string, leadId: string, now = Date.now()) {
  const [row] = await db.select({ lead: s.leads, price: s.listings.price }).from(s.leads).leftJoin(s.listings, eq(s.listings.id, s.leads.listingId)).where(scope(s.leads, tenantId, eq(s.leads.id, leadId)));
  if (!row) return null;
  const [eng] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.leadActivities)
    .where(scope(s.leadActivities, tenantId, eq(s.leadActivities.leadId, leadId), gte(s.leadActivities.occurredAt, new Date(now - 14 * DAY)), sql`${s.leadActivities.type} in ('call','whatsapp','viewing','email')`));
  const l = row.lead;
  const { score, factors } = scoreLead({
    email: l.email,
    phone: l.phone,
    intent: l.intent,
    timeline: l.timeline,
    source: l.source,
    budgetMin: l.budgetMin,
    budgetMax: l.budgetMax,
    listingPrice: row.price ?? null,
    recentEngagements: eng?.n ?? 0,
    daysSinceContact: l.lastContactAt ? Math.floor((now - l.lastContactAt.getTime()) / DAY) : null,
    daysSinceCreated: Math.floor((now - l.createdAt.getTime()) / DAY),
  });
  await db.update(s.leads).set({ score, scoreFactors: factors }).where(eq(s.leads.id, leadId));
  return { score, factors };
}

async function nextReference(db: DB, tenantId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(s.leads).where(scope(s.leads, tenantId));
  return `LD-${String((r?.n ?? 0) + 1).padStart(4, "0")}`;
}

export interface NewLead {
  name: string;
  email?: string | null;
  phone?: string | null;
  source: string;
  sourceRef?: string | null;
  market: string;
  intent: LeadIntent;
  timeline?: LeadTimeline;
  propertyType?: string | null;
  budgetMin?: number | null;
  budgetMax?: number | null;
  locations?: string[];
  listingId?: string | null;
  message?: string | null;
  ownerUserId?: string | null;
  consentMarketing?: boolean;
}

/** Creates a lead, assigns it (round-robin over the firm's analysts when no owner is given), records how it arrived and scores it. */
export async function createLead(db: DB, tenantId: string, n: NewLead, actor: { id?: string | null; name: string }) {
  if (!n.email && !n.phone) throw new HttpError(422, "A lead needs an email address or a phone number.");
  const market = marketOf(n.market);
  let owner = n.ownerUserId ?? null;
  if (!owner) {
    const staff = await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.tenantId, tenantId), sql`${s.users.role} in ('analyst','tenant_admin')`)).orderBy(s.users.createdAt);
    const [c] = await db.select({ n: sql<number>`count(*)::int` }).from(s.leads).where(scope(s.leads, tenantId));
    owner = staff.length ? staff[(c?.n ?? 0) % staff.length]!.id : null;
  }
  const [lead] = await db
    .insert(s.leads)
    .values({
      tenantId,
      reference: await nextReference(db, tenantId),
      name: n.name,
      email: n.email ?? null,
      phone: n.phone ?? null,
      source: n.source,
      sourceRef: n.sourceRef ?? null,
      market: market.code,
      intent: n.intent,
      timeline: n.timeline ?? "exploring",
      propertyType: n.propertyType ?? null,
      budgetMin: n.budgetMin ?? null,
      budgetMax: n.budgetMax ?? null,
      currency: market.currency,
      locations: n.locations ?? [],
      listingId: n.listingId ?? null,
      message: n.message ?? null,
      ownerUserId: owner,
      consentMarketing: n.consentMarketing ?? false,
      nextAction: "First contact",
      nextActionAt: new Date(Date.now() + 2 * 3_600_000),
    })
    .returning();
  await db.insert(s.leadActivities).values({ tenantId, leadId: lead!.id, type: "inbound", summary: `Enquiry via ${SOURCE_NAME[n.source] ?? n.source}${n.message ? `: "${n.message.slice(0, 160)}"` : ""}`, userId: actor.id ?? null });
  await rescore(db, tenantId, lead!.id);
  return lead!;
}

export async function setStage(db: DB, tenantId: string, leadId: string, stage: LeadStage, actor: { id?: string | null }, lostReason?: string) {
  const [lead] = await db.select().from(s.leads).where(scope(s.leads, tenantId, eq(s.leads.id, leadId)));
  if (!lead) throw new HttpError(404, "Lead not found.");
  if (stage === "lost" && !lostReason) throw new HttpError(422, "Record why the lead was lost; the reason feeds the conversion report.");
  await db.update(s.leads).set({ stage, lostReason: stage === "lost" ? lostReason : null }).where(eq(s.leads.id, leadId));
  await db.insert(s.leadActivities).values({ tenantId, leadId, type: "stage", summary: `Moved from ${STAGE_LABEL[lead.stage]} to ${STAGE_LABEL[stage]}${lostReason ? `: ${lostReason}` : ""}`, userId: actor.id ?? null });
  return rescore(db, tenantId, leadId);
}

export async function logActivity(db: DB, tenantId: string, leadId: string, a: { type: "call" | "email" | "whatsapp" | "viewing" | "note"; summary: string; outcome?: string | null; nextAction?: string | null; nextActionAt?: string | null }, actor: { id?: string | null }) {
  const [lead] = await db.select({ id: s.leads.id, stage: s.leads.stage }).from(s.leads).where(scope(s.leads, tenantId, eq(s.leads.id, leadId)));
  if (!lead) throw new HttpError(404, "Lead not found.");
  await db.insert(s.leadActivities).values({ tenantId, leadId, type: a.type, summary: a.summary, outcome: a.outcome ?? null, userId: actor.id ?? null });
  const contact = a.type !== "note";
  await db
    .update(s.leads)
    .set({
      ...(contact ? { lastContactAt: new Date() } : {}),
      ...(a.nextAction !== undefined ? { nextAction: a.nextAction, nextActionAt: a.nextActionAt ? new Date(a.nextActionAt) : null } : {}),
      ...(contact && lead.stage === "new" ? { stage: "contacted" as const } : {}),
      ...(a.type === "viewing" && ["new", "contacted", "qualified"].includes(lead.stage) ? { stage: "viewing" as const } : {}),
    })
    .where(eq(s.leads.id, leadId));
  return rescore(db, tenantId, leadId);
}

/** International number as wa.me expects it: digits only. */
export const whatsappLink = (phone: string, text: string) => `https://wa.me/${phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(text)}`;

/**
 * Normalises an inbound portal enquiry. Portals name fields differently; the
 * common spellings are mapped, and the raw payload is kept on the activity.
 */
export function normaliseInbound(portal: string, raw: Record<string, unknown>) {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
    return null;
  };
  const name = pick("name", "full_name", "fullName", "contact_name", "client_name", "enquirer_name") ?? [pick("first_name", "firstName"), pick("last_name", "lastName")].filter(Boolean).join(" ");
  const p = PORTAL_INDEX[portal];
  const budget = Number(pick("budget", "max_price", "price_to", "budget_max") ?? NaN);
  const intentRaw = (pick("intent", "purpose", "category", "type") ?? "").toLowerCase();
  return {
    name: name || "Portal enquiry",
    email: pick("email", "email_address", "emailAddress", "contact_email"),
    phone: pick("phone", "mobile", "phone_number", "phoneNumber", "contact_phone", "telephone"),
    message: pick("message", "comments", "enquiry", "body", "note"),
    listingReference: pick("listing_reference", "property_reference", "reference", "ref", "listing_ref", "agent_ref"),
    sourceRef: pick("lead_id", "enquiry_id", "id"),
    budgetMax: Number.isFinite(budget) && budget > 0 ? budget : null,
    intent: (/rent|let|lease/.test(intentRaw) ? "rent" : "buy") as LeadIntent,
    market: p?.market ?? "AE",
  };
}
