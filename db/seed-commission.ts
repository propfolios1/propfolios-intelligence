import { and, eq, isNull } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { computeForDeal, ensureDefaultStructures, recordPayment } from "@/lib/commission/service";
import { DEAL_STAGES } from "@/lib/deals/domain";

const DAY = 86_400_000;
const cr = (x: number) => Math.round(x * 10_000_000);

/**
 * Commission history: three deals closed in earlier months (Mumbai resale,
 * Dubai off-plan paid by the developer, Dubai prime on the tiered structure)
 * so each tenant has four commissions, two invoices (one paid) and splits.
 * The seeded Dubai deal's commission comes from the close chain itself.
 */
export async function seedCommissions(db: DB, t: { tenantId: string; slug?: string; id: (k: string) => string; staff: boolean; adminUserId?: string }) {
  await ensureDefaultStructures(db, t.tenantId);
  // Closed deals without a commission (workspaces seeded before the commission layer) get one now.
  const won = await db.select({ id: s.deals.id, closed: s.deals.actualCloseDate }).from(s.deals).leftJoin(s.commissions, eq(s.commissions.dealId, s.deals.id)).where(and(eq(s.deals.tenantId, t.tenantId), eq(s.deals.status, "won"), isNull(s.commissions.id)));
  for (const w of won) await computeForDeal(db, { tenantId: t.tenantId, name: "Finance" }, w.id, { inline: true, issue: true, at: w.closed ? new Date(`${w.closed}T12:00:00Z`) : undefined });
  const [exists] = await db.select({ id: s.deals.id }).from(s.deals).where(and(eq(s.deals.tenantId, t.tenantId), eq(s.deals.reference, "DL-H001"))).limit(1);
  if (exists) return { commissions: won.length };
  const owner = (k: "aisha" | "rohan") => (t.staff ? t.id(`user:${k}`) : (t.adminUserId ?? null));
  const actor = { tenantId: t.tenantId, name: "Finance" };
  const hist = [
    { ref: "DL-H001", client: "rajesh", prop: "lodha-park", jurisdiction: "mumbai" as const, dealType: "residential_resale" as const, value: cr(4.6), currency: "INR", counterparty: "Mehra family trust", owner: "rohan" as const, closed: 210, title: "Acquisition of Lodha Park for Rajesh Mehta" },
    { ref: "DL-H002", client: "fatima", prop: "sobha-creek-vistas", jurisdiction: "dubai" as const, dealType: "off_plan" as const, value: 2_450_000, currency: "AED", counterparty: "Sobha Realty", owner: "aisha" as const, closed: 120, title: "Off-plan purchase at Sobha Creek Vistas for Fatima Al Suwaidi" },
    { ref: "DL-H003", client: "khalid", prop: "palm-beach-towers", jurisdiction: "dubai" as const, dealType: "residential_resale" as const, value: 14_500_000, currency: "AED", counterparty: "Private vendor (UK resident)", owner: "aisha" as const, closed: 75, title: "Acquisition of a Palm Beach Towers penthouse for Khalid bin Rashid" },
  ];
  for (const h of hist) {
    const pace = t.slug === "gulfrealty" ? 1.25 : t.slug === "bombay" ? 0.8 : 1;
    const closedAt = new Date(Date.now() - h.closed * DAY);
    const created = new Date(closedAt.getTime() - 50 * pace * DAY);
    const [d] = await db
      .insert(s.deals)
      .values({ tenantId: t.tenantId, reference: h.ref, title: h.title, clientId: t.id(`client:${h.client}`), propertyId: t.id(`prop:${h.prop}`), jurisdiction: h.jurisdiction, dealType: h.dealType, side: "buy", stage: "closed", status: "won", currency: h.currency, value: h.value, counterparty: h.counterparty, ownerUserId: owner(h.owner), probability: 1, targetCloseDate: closedAt.toISOString().slice(0, 10), actualCloseDate: closedAt.toISOString().slice(0, 10), createdAt: created })
      .returning();
    await db.insert(s.dealStages).values(DEAL_STAGES.map((name, order) => ({ tenantId: t.tenantId, dealId: d!.id, name, order, enteredAt: new Date(created.getTime() + order * 7 * DAY), completedAt: name === "closed" ? null : new Date(created.getTime() + (order + 1) * 7 * DAY), completedBy: "Advisory team" })));
    const issue = h.ref === "DL-H002";
    const r = await computeForDeal(db, actor, d!.id, { inline: true, at: closedAt, issue });
    if (issue && r.commission) {
      const [inv] = await db.select().from(s.invoices).where(and(eq(s.invoices.tenantId, t.tenantId), eq(s.invoices.dealId, d!.id)));
      if (inv) await recordPayment(db, actor, inv.id, { amount: inv.total - (inv.tax.tdsAmount ?? 0), method: "bank_transfer", reference: `SOBHA-PAY-${inv.number}`, receivedAt: new Date(closedAt.getTime() + 24 * DAY) }, { inline: true });
      const sp = await db.select().from(s.splits).where(eq(s.splits.commissionId, r.commission.id));
      for (const x of sp) await db.update(s.splits).set({ status: "paid" }).where(eq(s.splits.id, x.id));
      await db.update(s.commissions).set({ status: "paid_out" }).where(eq(s.commissions.id, r.commission.id));
    }
  }
  return { commissions: 3 };
}
