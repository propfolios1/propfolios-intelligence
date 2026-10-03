import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { runDealAgent } from "@/lib/deals/agents";
import { addNegotiationRound, closeDeal, createDeal, createOffer, generateContract, respondOffer, sendForSignature, signAllForSeed, updateChecklistItem, updatePayment } from "@/lib/deals/service";
import { CLIENTS } from "./seed-data";

const DAY = 86_400_000;
const cr = (x: number) => Math.round(x * 10_000_000);

/**
 * Four deals per tenant at different stages, built through the deal service
 * so stages, checklists, events and agent outputs are exactly what the
 * product produces: one closed in Dubai, one paying in Mumbai, one in
 * negotiation in Goa, one out for signature in Abu Dhabi. Skipped when the
 * tenant already has its first deal (idempotent).
 */
export async function seedDeals(db: DB, t: { tenantId: string; id: (k: string) => string; staff: boolean; adminUserId?: string }) {
  const [exists] = await db.select({ id: s.deals.id }).from(s.deals).where(and(eq(s.deals.tenantId, t.tenantId), eq(s.deals.reference, "DL-0001"))).limit(1);
  if (exists) return { deals: 0 };
  const owner = (k: "aisha" | "rohan") => (t.staff ? t.id(`user:${k}`) : (t.adminUserId ?? null));
  const actor = (k: "aisha" | "rohan") => ({ tenantId: t.tenantId, name: t.staff ? (k === "aisha" ? "Aisha Rahman" : "Rohan Mehta") : "Advisory team", id: owner(k) ?? undefined });
  const client = (k: string) => ({ id: t.id(`client:${k}`), ...CLIENTS.find((c) => c.key === k)! });
  const prop = (slug: string) => t.id(`prop:${slug}`);
  const ago = (d: number) => new Date(Date.now() - d * DAY);
  const doneAll = async (dealId: string, a: ReturnType<typeof actor>, keepOpen = 0) => {
    const items = await db.select().from(s.closingChecklists).where(and(eq(s.closingChecklists.tenantId, t.tenantId), eq(s.closingChecklists.dealId, dealId)));
    for (const it of items.slice(0, items.length - keepOpen)) await updateChecklistItem(db, a, it.id, "done");
  };

  /* 1. Dubai, closed: Downtown Views for Ahmed Al Mansoori */
  {
    const a = actor("aisha");
    const c = client("ahmed");
    const d = await createDeal(db, a, { clientId: c.id, propertyId: prop("downtown-views"), side: "buy", value: 3_250_000, counterparty: "Elena Petrova", ownerUserId: owner("aisha"), notes: "Vendor relocating to Lisbon; wants completion within 45 days.", targetCloseDate: ago(5).toISOString().slice(0, 10) }, { inline: true, reference: "DL-0001", createdAt: ago(58) });
    const o1 = await createOffer(db, a, d.id, { type: "offer", party: "buyer", amount: 3_050_000, submit: true, terms: { depositPct: 10, completionDays: 30, conditions: ["Developer NOC", "Clear service charge account"] } }, { inline: true, at: ago(55) });
    const o2 = await createOffer(db, a, d.id, { type: "counter", party: "seller", amount: 3_320_000, submit: true, parentOfferId: o1.id, terms: { depositPct: 10, completionDays: 45 } }, { inline: true, at: ago(52) });
    await addNegotiationRound(db, a, d.id, { party: "seller", price: 3_320_000, asks: ["Completion within 45 days"], concessions: ["Leaves furniture and appliances"] }, ago(51));
    const o3 = await createOffer(db, a, d.id, { type: "counter", party: "buyer", amount: 3_180_000, submit: true, parentOfferId: o2.id, terms: { depositPct: 10, completionDays: 30, conditions: ["Developer NOC", "Clear service charge account"] } }, { inline: true, at: ago(49) });
    await respondOffer(db, a, o3.id, "accepted", "Accepted with furniture included.", ago(47));
    const k = await generateContract(db, a, d.id, "form_f", ago(46));
    await sendForSignature(db, a, k.id, [{ party: "buyer", name: c.name, email: c.email }, { party: "seller", name: "Elena Petrova", email: "elena.petrova@counterparty.example" }], { at: ago(46), skipEmail: true, forceNative: true });
    await signAllForSeed(db, t.tenantId, k.id, ago(45));
    await doneAll(d.id, a);
    const pays = await db.select().from(s.paymentsSchedule).where(and(eq(s.paymentsSchedule.tenantId, t.tenantId), eq(s.paymentsSchedule.dealId, d.id)));
    for (const p of pays) await updatePayment(db, a, p.id, { status: "paid", reference: `MC-${p.milestone.slice(0, 3).toUpperCase()}-0412` });
    await closeDeal(db, a, d.id, { inline: true, at: ago(14) });
  }

  /* 2. Mumbai, payment stage: Rustomjee Elements for Rajesh Mehta (NRI) */
  {
    const a = actor("rohan");
    const c = client("rajesh");
    const d = await createDeal(db, a, { clientId: c.id, propertyId: prop("rustomjee-elements"), side: "buy", dealType: "co_op_resale", value: cr(5.36), counterparty: "Vikram and Anjali Khanna", ownerUserId: owner("rohan"), notes: "Sellers upgrading within Juhu; want registration before Diwali." }, { inline: true, reference: "DL-0002", createdAt: ago(40) });
    const o1 = await createOffer(db, a, d.id, { type: "offer", party: "buyer", amount: cr(5.05), submit: true, terms: { depositPct: 10, completionDays: 45, conditions: ["Society NOC", "Clear title for 30 years"] } }, { inline: true, at: ago(37) });
    const o2 = await createOffer(db, a, d.id, { type: "counter", party: "seller", amount: cr(5.36), submit: true, parentOfferId: o1.id, terms: { depositPct: 10, completionDays: 30 } }, { inline: true, at: ago(34) });
    await addNegotiationRound(db, a, d.id, { party: "buyer", price: cr(5.2), asks: ["Society NOC before agreement"], concessions: ["Registration before Diwali"] }, ago(32));
    const o3 = await createOffer(db, a, d.id, { type: "final", party: "buyer", amount: cr(5.2), submit: true, parentOfferId: o2.id, terms: { depositPct: 10, completionDays: 45, conditions: ["Society NOC", "Clear title for 30 years"] } }, { inline: true, at: ago(31) });
    await respondOffer(db, a, o3.id, "accepted", undefined, ago(29));
    const k = await generateContract(db, a, d.id, "agreement_for_sale", ago(26));
    await sendForSignature(db, a, k.id, [{ party: "buyer", name: c.name, email: c.email }, { party: "seller", name: "Vikram Khanna", email: "vikram.khanna@counterparty.example" }], { at: ago(25), skipEmail: true, forceNative: true });
    await signAllForSeed(db, t.tenantId, k.id, ago(24));
    await doneAll(d.id, a, 3);
    const [first] = await db.select().from(s.paymentsSchedule).where(and(eq(s.paymentsSchedule.tenantId, t.tenantId), eq(s.paymentsSchedule.dealId, d.id))).orderBy(s.paymentsSchedule.dueDate).limit(1);
    if (first) await updatePayment(db, a, first.id, { status: "paid", reference: "NEFT-HDFC-88241" });
  }

  /* 3. Goa, negotiation: Sun Estates Assagao villa for Priya Sharma */
  {
    const a = actor("rohan");
    const c = client("priya");
    const d = await createDeal(db, a, { clientId: c.id, propertyId: prop("sun-assagao-villas"), side: "buy", dealType: "freehold_villa", value: cr(5.8), counterparty: "Sun Estates Developers", ownerUserId: owner("rohan"), notes: "Developer holding the last two villas for a December launch price rise." }, { inline: true, reference: "DL-0003", createdAt: ago(18) });
    const o1 = await createOffer(db, a, d.id, { type: "offer", party: "buyer", amount: cr(5.2), submit: true, terms: { depositPct: 10, completionDays: 60, conditions: ["Form I and XIV in the developer's name", "No mundkar claim"] } }, { inline: true, at: ago(15) });
    await createOffer(db, a, d.id, { type: "counter", party: "seller", amount: cr(5.6), submit: true, parentOfferId: o1.id, terms: { depositPct: 15, completionDays: 45 } }, { inline: true, at: ago(9) });
    await addNegotiationRound(db, a, d.id, { party: "seller", price: cr(5.6), asks: ["15% deposit"], concessions: ["Pool heating and furnishings included"] }, ago(9));
    await addNegotiationRound(db, a, d.id, { party: "advisor", asks: ["Rental pool income guarantee for 12 months"], concessions: ["Completion in 45 days"], notes: "Client prefers certainty on rental income over furnishings." }, ago(4));
    await doneAll(d.id, a, 9);
  }

  /* 4. Abu Dhabi, signing: Saadiyat Reserve for Khalid bin Rashid */
  {
    const a = actor("aisha");
    const c = client("khalid");
    const d = await createDeal(db, a, { clientId: c.id, propertyId: prop("saadiyat-reserve"), side: "buy", value: 7_400_000, counterparty: "Aldar Properties PJSC (resale desk)", ownerUserId: owner("aisha") }, { inline: true, reference: "DL-0004", createdAt: ago(12) });
    const o1 = await createOffer(db, a, d.id, { type: "offer", party: "buyer", amount: 7_150_000, submit: true, terms: { depositPct: 10, completionDays: 30, conditions: ["Master developer NOC"] } }, { inline: true, at: ago(10) });
    await respondOffer(db, a, o1.id, "accepted", undefined, ago(8));
    const k = await generateContract(db, a, d.id, "spa", ago(6));
    await sendForSignature(db, a, k.id, [{ party: "buyer", name: c.name, email: c.email }, { party: "seller", name: "Aldar resale desk", email: "resales@counterparty.example" }], { at: ago(5), skipEmail: true, forceNative: true });
    const [sig] = await db.select().from(s.signatures).where(and(eq(s.signatures.tenantId, t.tenantId), eq(s.signatures.contractId, k.id), eq(s.signatures.party, "seller")));
    if (sig) await db.update(s.signatures).set({ status: "signed", signedAt: ago(3), ipAddress: "185.93.24.10", userAgent: "Mozilla/5.0 (Windows NT 10.0)", tokenHash: null }).where(eq(s.signatures.id, sig.id));
    await doneAll(d.id, a, 4);
  }
  // Refresh the forecast and closing plan on the final state of each deal.
  const all = await db.select({ id: s.deals.id }).from(s.deals).where(eq(s.deals.tenantId, t.tenantId));
  for (const d of all) {
    await runDealAgent(db, { tenantId: t.tenantId, name: "Seed" }, d.id, "deal-predictor");
    await runDealAgent(db, { tenantId: t.tenantId, name: "Seed" }, d.id, "closing-coordinator");
  }
  return { deals: 4 };
}
