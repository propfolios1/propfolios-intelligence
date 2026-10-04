import "server-only";
import { and, eq, gte, inArray, type SQL } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { sendEmail } from "@/lib/os/notify";
import { scope } from "@/lib/tenant-db";
import { createLead } from "./leads";

/** Audience segments, built from leads that gave marketing consent. */
export const SEGMENTS = {
  all: { label: "All leads with marketing consent", where: (): SQL | undefined => undefined },
  buyers: { label: "Buyers and investors", where: () => inArray(s.leads.intent, ["buy", "invest"]) },
  tenants: { label: "Tenants looking to rent", where: () => eq(s.leads.intent, "rent") },
  owners: { label: "Owners looking to sell or let", where: () => inArray(s.leads.intent, ["sell", "let"]) },
  hot: { label: "Hot leads, score 70 and above", where: () => gte(s.leads.score, 70) },
} as const;
export type SegmentKey = keyof typeof SEGMENTS;

export async function segmentMembers(db: DB, tenantId: string, key: SegmentKey) {
  return db
    .select({ id: s.leads.id, name: s.leads.name, email: s.leads.email })
    .from(s.leads)
    .where(scope(s.leads, tenantId, eq(s.leads.consentMarketing, true), SEGMENTS[key].where(), inArray(s.leads.stage, ["new", "contacted", "qualified", "viewing", "offer"])));
}

/**
 * Sends an email campaign to its segment through the firm's outbox (Resend
 * when configured). Recipients without an email address are skipped and
 * counted; the campaign records what was actually queued.
 */
export async function sendCampaign(db: DB, tenantId: string, campaignId: string) {
  const [c] = await db.select().from(s.campaigns).where(scope(s.campaigns, tenantId, eq(s.campaigns.id, campaignId)));
  if (!c) throw new HttpError(404, "Campaign not found.");
  if (c.channel !== "email") throw new HttpError(422, "Only email campaigns are sent from Nakhla; post social and portal campaigns from their own tools and record the results here.");
  if (c.status === "sent" || c.status === "completed") throw new HttpError(409, "This campaign has already been sent.");
  if (!c.subject || c.body.trim().length < 40) throw new HttpError(422, "Add a subject and a body of at least 40 characters before sending.");
  const members = await segmentMembers(db, tenantId, c.segment as SegmentKey);
  const withEmail = members.filter((m) => m.email);
  for (const m of withEmail) await sendEmail(db, { tenantId, to: m.email!, subject: c.subject, text: c.body.replace(/^Dear client,/, `Dear ${m.name.split(" ")[0]},`) });
  const metrics = { ...c.metrics, audience: members.length, sent: withEmail.length };
  await db.update(s.campaigns).set({ status: "sent", sentAt: new Date(), metrics }).where(and(eq(s.campaigns.id, c.id), eq(s.campaigns.tenantId, tenantId)));
  return { sent: withEmail.length, skipped: members.length - withEmail.length };
}

/** A client referral becomes a lead from the "referral" source and is linked back to the referrer. */
export async function createReferral(db: DB, tenantId: string, r: { referrerClientId: string | null; referrerName: string; referredName: string; referredEmail?: string | null; referredPhone?: string | null; market: string; intent: "buy" | "rent" | "sell" | "let" | "invest"; notes?: string | null }, actor: { id?: string | null; name: string }) {
  const lead = await createLead(db, tenantId, { name: r.referredName, email: r.referredEmail ?? null, phone: r.referredPhone ?? null, source: "referral", market: r.market, intent: r.intent, timeline: "3_months", message: `Referred by ${r.referrerName}${r.notes ? `: ${r.notes}` : ""}`, consentMarketing: false }, actor);
  const [ref] = await db.insert(s.referrals).values({ tenantId, referrerClientId: r.referrerClientId, referrerName: r.referrerName, referredName: r.referredName, referredEmail: r.referredEmail ?? null, leadId: lead.id, notes: r.notes ?? null }).returning();
  return { referral: ref!, lead };
}
