import "server-only";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { DealType, Jurisdiction, OfferTerms } from "@/db/schema";
import { publish } from "@/lib/ai/orchestration/event-bus";
import { embed } from "@/lib/ai/embed";
import { DomainError } from "@/lib/errors";
import { formatLocal } from "@/lib/format";
import { sendEmail } from "@/lib/os/notify";
import { jurisdictionOf } from "@/lib/regulations";
import { scope } from "@/lib/tenant-db";
import { CONTRACT_TYPES, checklistFor, DEAL_STAGES, type DealStage, paymentPlanFor, renderContract } from "./domain";
import { appUrl, contentHash, dropboxSignConfigured, hashToken, newToken, sendViaDropboxSign } from "./signature";

export interface Actor {
  tenantId: string;
  name: string;
  id?: string;
}

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export function toJurisdiction(city: string, market: string): Jurisdiction {
  const j = jurisdictionOf(city, market === "India" ? "India" : undefined);
  return j === "maharashtra" ? (market === "India" && /mumbai|thane/i.test(city) ? "mumbai" : "other") : j;
}

async function dealOr404(db: DB, tenantId: string, dealId: string) {
  const [d] = await db.select().from(s.deals).where(scope(s.deals, tenantId, eq(s.deals.id, dealId)));
  if (!d) throw new DomainError("Deal not found.", 404);
  return d;
}

export async function nextDealReference(db: DB, tenantId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(s.deals).where(scope(s.deals, tenantId));
  return `DL-${String((r?.n ?? 0) + 1).padStart(4, "0")}`;
}

/** Moves the deal to a stage: completes every earlier stage and enters this one. Never moves backwards. */
export async function setStage(db: DB, actor: Actor, dealId: string, stage: DealStage, notes?: string, at = new Date()) {
  const d = await dealOr404(db, actor.tenantId, dealId);
  const from = DEAL_STAGES.indexOf(d.stage);
  const to = DEAL_STAGES.indexOf(stage);
  if (to <= from) return d;
  const now = at;
  await db
    .update(s.dealStages)
    .set({ completedAt: now, completedBy: actor.name })
    .where(scope(s.dealStages, actor.tenantId, eq(s.dealStages.dealId, dealId), sql`${s.dealStages.order} < ${to}`, sql`${s.dealStages.completedAt} is null`));
  await db.update(s.dealStages).set({ enteredAt: now, notes: notes ?? null }).where(scope(s.dealStages, actor.tenantId, eq(s.dealStages.dealId, dealId), eq(s.dealStages.name, stage)));
  const [u] = await db.update(s.deals).set({ stage }).where(scope(s.deals, actor.tenantId, eq(s.deals.id, dealId))).returning();
  const { factsFor, runAutomations } = await import("@/lib/os/automations");
  await runAutomations(db, actor.tenantId, "deal.stage_changed", await factsFor(db, actor.tenantId, { dealId, label: `${d.reference} moved to ${stage}`, href: `/analyst/deals/${dealId}` }));
  return u!;
}

export async function createDeal(
  db: DB,
  actor: Actor,
  i: { clientId: string; propertyId: string; mandateId?: string | null; side: "buy" | "sell"; dealType?: DealType; value: number; currency?: string; counterparty: string; targetCloseDate?: string | null; ownerUserId?: string | null; title?: string; notes?: string },
  opts: { inline?: boolean; reference?: string; createdAt?: Date } = {},
) {
  const [client] = await db.select().from(s.clients).where(scope(s.clients, actor.tenantId, eq(s.clients.id, i.clientId)));
  const [prop] = await db.select().from(s.properties).where(scope(s.properties, actor.tenantId, eq(s.properties.id, i.propertyId)));
  if (!client || !prop) throw new DomainError("Client or property not found.", 404);
  const jurisdiction = toJurisdiction(prop.city, prop.market);
  const dealType: DealType = i.dealType ?? (prop.status !== "ready" ? "off_plan" : prop.assetClass === "Villa" ? "freehold_villa" : /commercial/i.test(prop.assetClass) ? "commercial" : "residential_resale");
  const reference = opts.reference ?? (await nextDealReference(db, actor.tenantId));
  const created = opts.createdAt ?? new Date();
  const [deal] = await db
    .insert(s.deals)
    .values({ tenantId: actor.tenantId, reference, title: i.title ?? `${i.side === "buy" ? "Acquisition" : "Disposal"} of ${prop.name} for ${client.name}`, mandateId: i.mandateId ?? null, clientId: client.id, propertyId: prop.id, jurisdiction, dealType, side: i.side, currency: i.currency ?? prop.currency, value: i.value, counterparty: i.counterparty, targetCloseDate: i.targetCloseDate ?? isoDay(new Date(created.getTime() + 60 * DAY)), ownerUserId: i.ownerUserId ?? actor.id ?? null, notes: i.notes ?? null, createdAt: created })
    .returning();
  await db.insert(s.dealStages).values(DEAL_STAGES.map((name, order) => ({ tenantId: actor.tenantId, dealId: deal!.id, name, order, enteredAt: order === 0 ? created : null })));
  await db.insert(s.closingChecklists).values(checklistFor(jurisdiction, dealType).map((c, k) => ({ tenantId: actor.tenantId, dealId: deal!.id, item: c.item, category: c.category, reference: c.reference, severity: c.severity, dueDate: isoDay(new Date(created.getTime() + c.dueOffsetDays * DAY)), sort: k })));
  await publish(db, { type: "deal.created", tenantId: actor.tenantId, entityType: "deal", entityId: deal!.id, dealId: deal!.id, mandateId: deal!.mandateId, clientId: client.id, actor: actor.name, payload: { label: `${reference}: ${deal!.title}`, href: `/analyst/deals/${deal!.id}` }, at: created }, { inline: opts.inline });
  return deal!;
}

export async function createOffer(db: DB, actor: Actor, dealId: string, i: { type: "offer" | "counter" | "final"; party: "buyer" | "seller"; amount: number; terms?: OfferTerms; expiresInDays?: number; submit?: boolean; parentOfferId?: string | null }, opts: { inline?: boolean; at?: Date } = {}) {
  const d = await dealOr404(db, actor.tenantId, dealId);
  if (d.status !== "active") throw new DomainError("Offers can only be made on an active deal.");
  const at = opts.at ?? new Date();
  if (i.parentOfferId) await db.update(s.offers).set({ status: "countered", responseAt: at }).where(scope(s.offers, actor.tenantId, eq(s.offers.id, i.parentOfferId), eq(s.offers.dealId, dealId)));
  const [o] = await db
    .insert(s.offers)
    .values({ tenantId: actor.tenantId, dealId, parentOfferId: i.parentOfferId ?? null, type: i.type, party: i.party, amount: i.amount, currency: d.currency, terms: i.terms ?? {}, status: i.submit ? "submitted" : "draft", submittedAt: i.submit ? at : null, expiresAt: new Date(at.getTime() + (i.expiresInDays ?? 5) * DAY), createdBy: actor.name, createdAt: at })
    .returning();
  if (i.submit) {
    await setStage(db, actor, dealId, i.parentOfferId ? "negotiation" : "offer", undefined, at);
    await publish(db, { type: "deal.offer_sent", tenantId: actor.tenantId, entityType: "deal", entityId: dealId, dealId, clientId: d.clientId, mandateId: d.mandateId, actor: actor.name, payload: { label: `${d.reference}: ${i.type} of ${formatLocal(i.amount, d.currency)} by the ${i.party}`, offerId: o!.id, href: `/analyst/deals/${dealId}?tab=offers` }, at }, { inline: opts.inline });
  }
  return o!;
}

export async function submitOffer(db: DB, actor: Actor, offerId: string) {
  const [o] = await db.select().from(s.offers).where(scope(s.offers, actor.tenantId, eq(s.offers.id, offerId)));
  if (!o || o.status !== "draft") throw new DomainError("Only a draft offer can be submitted.");
  await db.delete(s.offers).where(eq(s.offers.id, o.id));
  return createOffer(db, actor, o.dealId, { type: o.type, party: o.party, amount: o.amount, terms: o.terms, submit: true, parentOfferId: o.parentOfferId });
}

/** Records the counterparty's response. Acceptance fixes the deal value and moves the deal to contract. */
export async function respondOffer(db: DB, actor: Actor, offerId: string, decision: "accepted" | "rejected" | "withdrawn", response?: string, at = new Date()) {
  const [o] = await db.select().from(s.offers).where(scope(s.offers, actor.tenantId, eq(s.offers.id, offerId)));
  if (!o) throw new DomainError("Offer not found.", 404);
  if (o.status !== "submitted") throw new DomainError("Only a submitted offer can be answered.");
  const [u] = await db.update(s.offers).set({ status: decision, response: response ?? null, responseAt: at }).where(eq(s.offers.id, o.id)).returning();
  if (decision === "accepted") {
    await db.update(s.offers).set({ status: "expired" }).where(scope(s.offers, actor.tenantId, eq(s.offers.dealId, o.dealId), ne(s.offers.id, o.id), inArray(s.offers.status, ["draft", "submitted"])));
    await db.update(s.deals).set({ value: o.amount, probability: 0.85 }).where(scope(s.deals, actor.tenantId, eq(s.deals.id, o.dealId)));
    await setStage(db, actor, o.dealId, "contract", `Accepted ${o.type} of ${formatLocal(o.amount, o.currency)}`, at);
  }
  return u!;
}

export async function addNegotiationRound(db: DB, actor: Actor, dealId: string, i: { party: "buyer" | "seller" | "advisor"; price?: number; asks: string[]; concessions: string[]; notes?: string }, at = new Date()) {
  const d = await dealOr404(db, actor.tenantId, dealId);
  const [m] = await db.select({ n: sql<number>`coalesce(max(${s.negotiations.roundNumber}), 0)::int` }).from(s.negotiations).where(scope(s.negotiations, actor.tenantId, eq(s.negotiations.dealId, dealId)));
  const [row] = await db.insert(s.negotiations).values({ tenantId: actor.tenantId, dealId, roundNumber: (m?.n ?? 0) + 1, party: i.party, position: { price: i.price, currency: d.currency, asks: i.asks, concessions: i.concessions }, notes: i.notes ?? null, submittedAt: at, createdAt: at }).returning();
  if (d.stage === "origination" || d.stage === "offer") await setStage(db, actor, dealId, "negotiation", undefined, at);
  return row!;
}

export async function generateContract(db: DB, actor: Actor, dealId: string, type?: (typeof CONTRACT_TYPES)[Jurisdiction][number]["type"], at = new Date()) {
  const d = await dealOr404(db, actor.tenantId, dealId);
  const [client] = await db.select().from(s.clients).where(eq(s.clients.id, d.clientId));
  const [prop] = await db.select().from(s.properties).where(eq(s.properties.id, d.propertyId));
  const [tenant] = await db.select({ name: s.tenants.name }).from(s.tenants).where(eq(s.tenants.id, actor.tenantId));
  const [accepted] = await db.select().from(s.offers).where(scope(s.offers, actor.tenantId, eq(s.offers.dealId, dealId), eq(s.offers.status, "accepted"))).orderBy(desc(s.offers.responseAt)).limit(1);
  const options = CONTRACT_TYPES[d.jurisdiction];
  const spec = options.find((o) => o.type === type) ?? options[0]!;
  const [prev] = await db.select({ n: sql<number>`coalesce(max(${s.contracts.version}), 0)::int` }).from(s.contracts).where(scope(s.contracts, actor.tenantId, eq(s.contracts.dealId, dealId), eq(s.contracts.type, spec.type)));
  const terms = accepted?.terms ?? {};
  const html = renderContract({
    type: spec.type,
    title: spec.title,
    jurisdiction: d.jurisdiction,
    reference: `${d.reference}-${spec.type.toUpperCase().replace(/_/g, "")}-v${(prev?.n ?? 0) + 1}`,
    buyer: d.side === "buy" ? client!.name : d.counterparty,
    seller: d.side === "buy" ? d.counterparty : client!.name,
    property: prop!.name,
    community: prop!.community,
    reraNumber: prop!.reraNumber,
    price: formatLocal(accepted?.amount ?? d.value, d.currency, { compact: false }),
    depositPct: terms.depositPct ?? 10,
    completionDays: terms.completionDays ?? (d.jurisdiction === "dubai" ? 30 : 45),
    conditions: terms.conditions ?? [],
    firm: tenant?.name ?? "the adviser",
    date: at.toISOString().slice(0, 10),
  });
  const [c] = await db
    .insert(s.contracts)
    .values({ tenantId: actor.tenantId, dealId, type: spec.type, title: spec.title, contentHtml: html, version: (prev?.n ?? 0) + 1, status: "draft", contentHash: contentHash(html), createdBy: actor.name, embedding: embed(html.replace(/<[^>]+>/g, " ")), createdAt: at })
    .returning();
  if (d.stage !== "contract" && DEAL_STAGES.indexOf(d.stage) < DEAL_STAGES.indexOf("contract")) await setStage(db, actor, dealId, "contract", undefined, at);
  return c!;
}

/** Sends a contract for signature: Dropbox Sign when configured, otherwise the native flow (emailed link, email verification, IP and time recorded). */
export async function sendForSignature(db: DB, actor: Actor, contractId: string, signers: { party: "buyer" | "seller" | "advisor" | "witness"; name: string; email: string }[], opts: { at?: Date; skipEmail?: boolean; forceNative?: boolean } = {}) {
  const [c] = await db.select().from(s.contracts).where(scope(s.contracts, actor.tenantId, eq(s.contracts.id, contractId)));
  if (!c) throw new DomainError("Contract not found.", 404);
  if (c.status !== "draft") throw new DomainError("Only a draft contract can be sent for signature.");
  if (!signers.length) throw new DomainError("Add at least one signer.");
  const d = await dealOr404(db, actor.tenantId, c.dealId);
  const at = opts.at ?? new Date();
  const links: { email: string; url: string }[] = [];
  const useProvider = dropboxSignConfigured() && !opts.forceNative;
  if (useProvider) {
    const r = await sendViaDropboxSign({ title: c.title, html: c.contentHtml, reference: d.reference, signers, contractId: c.id });
    await db.insert(s.signatures).values(signers.map((x) => ({ tenantId: actor.tenantId, contractId: c.id, party: x.party, signerEmail: x.email.toLowerCase(), signerName: x.name, envelopeId: r.signatureIds[x.email.toLowerCase()] ?? r.requestId, createdAt: at })));
    await db.update(s.contracts).set({ status: "out_for_signature", provider: "dropbox_sign", providerRequestId: r.requestId }).where(eq(s.contracts.id, c.id));
  } else {
    for (const x of signers) {
      const token = newToken();
      await db.insert(s.signatures).values({ tenantId: actor.tenantId, contractId: c.id, party: x.party, signerEmail: x.email.toLowerCase(), signerName: x.name, tokenHash: hashToken(token), createdAt: at });
      const url = `${appUrl()}/sign/${token}`;
      links.push({ email: x.email, url });
      if (!opts.skipEmail) await sendEmail(db, { tenantId: actor.tenantId, to: x.email, subject: `${c.title} (${d.reference}) for your signature`, text: `${x.name},\n\n${c.title} for ${d.title} is ready for your signature.\n\nReview and sign: ${url}\n\nYou will be asked to confirm your email address. Your signature, the time and your network address are recorded.\n` });
    }
    await db.update(s.contracts).set({ status: "out_for_signature", provider: "native" }).where(eq(s.contracts.id, c.id));
  }
  await setStage(db, actor, c.dealId, "signing", undefined, at);
  return { provider: useProvider ? "dropbox_sign" : "native", links };
}

/** Completes a contract once every signer has signed: schedules payments and raises deal.contract_signed. */
async function completeIfSigned(db: DB, tenantId: string, contractId: string, actorName: string, opts: { inline?: boolean; at?: Date } = {}) {
  const sigs = await db.select().from(s.signatures).where(scope(s.signatures, tenantId, eq(s.signatures.contractId, contractId)));
  if (!sigs.length || sigs.some((x) => x.status !== "signed")) return false;
  const at = opts.at ?? new Date();
  const [c] = await db.update(s.contracts).set({ status: "signed", signedAt: at, effectiveDate: isoDay(at), signedBy: sigs.map((x) => ({ name: x.signerName, email: x.signerEmail, signedAt: (x.signedAt ?? at).toISOString() })) }).where(eq(s.contracts.id, contractId)).returning();
  const d = await dealOr404(db, tenantId, c!.dealId);
  const [existing] = await db.select({ n: sql<number>`count(*)::int` }).from(s.paymentsSchedule).where(scope(s.paymentsSchedule, tenantId, eq(s.paymentsSchedule.dealId, d.id)));
  if (!existing?.n) {
    const plan = paymentPlanFor(d.jurisdiction, d.dealType);
    await db.insert(s.paymentsSchedule).values(plan.map((p) => ({ tenantId, dealId: d.id, milestone: p.milestone, amount: Math.round(d.value * p.pct), currency: d.currency, dueDate: isoDay(new Date(at.getTime() + p.dayOffset * DAY)), status: p.dayOffset === 0 ? ("due" as const) : ("scheduled" as const) })));
  }
  await setStage(db, { tenantId, name: actorName }, d.id, "payment", undefined, at);
  await publish(db, { type: "deal.contract_signed", tenantId, entityType: "deal", entityId: d.id, dealId: d.id, clientId: d.clientId, mandateId: d.mandateId, actor: actorName, payload: { label: `${d.reference}: ${c!.title} signed by all parties`, contractId, href: `/analyst/deals/${d.id}?tab=contracts` }, at }, { inline: opts.inline });
  return true;
}

export async function signatureByToken(db: DB, token: string) {
  const [sig] = await db.select().from(s.signatures).where(eq(s.signatures.tokenHash, hashToken(token)));
  if (!sig) return null;
  const [c] = await db.select().from(s.contracts).where(eq(s.contracts.id, sig.contractId));
  const [d] = c ? await db.select().from(s.deals).where(eq(s.deals.id, c.dealId)) : [];
  const [t] = await db.select({ name: s.tenants.name }).from(s.tenants).where(eq(s.tenants.id, sig.tenantId));
  return c && d ? { sig, contract: c, deal: d, firm: t?.name ?? "" } : null;
}

/** Native signing: the signer must confirm the email the request was sent to. */
export async function signNative(db: DB, token: string, i: { email: string; name: string; ip: string | null; userAgent: string | null; decline?: boolean }) {
  const found = await signatureByToken(db, token);
  if (!found) throw new DomainError("This signing link is not valid.", 404);
  const { sig, contract } = found;
  if (sig.status === "signed") throw new DomainError("This document has already been signed.", 409);
  if (contract.status !== "out_for_signature") throw new DomainError("This document is no longer open for signature.", 409);
  if (i.email.trim().toLowerCase() !== sig.signerEmail) throw new DomainError("The email address does not match the one this request was sent to.", 403);
  if (i.name.trim().length < 3) throw new DomainError("Type your full name to sign.");
  const now = new Date();
  await db.update(s.signatures).set({ status: i.decline ? "declined" : "signed", signedAt: i.decline ? null : now, ipAddress: i.ip, userAgent: i.userAgent, signerName: i.decline ? sig.signerName : i.name.trim(), tokenHash: null }).where(eq(s.signatures.id, sig.id));
  await db.insert(s.auditLogs).values({ tenantId: sig.tenantId, actorName: i.name.trim(), actorType: "user", action: i.decline ? "declined contract" : "signed contract", entityType: "contract", entityId: contract.id, ip: i.ip, userAgent: i.userAgent, requestId: crypto.randomUUID(), after: { signer: sig.signerEmail, party: sig.party, contentHash: contract.contentHash, at: now.toISOString() } });
  if (!i.decline) await completeIfSigned(db, sig.tenantId, contract.id, i.name.trim());
  return { signed: !i.decline };
}

/** Dropbox Sign callback: marks the signer, then completes the contract when all have signed. */
export async function recordProviderSignature(db: DB, requestId: string, email: string, status: "signed" | "declined" | "viewed") {
  const [c] = await db.select().from(s.contracts).where(eq(s.contracts.providerRequestId, requestId));
  if (!c) return false;
  await db.update(s.signatures).set({ status, signedAt: status === "signed" ? new Date() : null }).where(and(eq(s.signatures.contractId, c.id), eq(s.signatures.signerEmail, email.toLowerCase())));
  if (status === "signed") await completeIfSigned(db, c.tenantId, c.id, "Dropbox Sign");
  return true;
}

/** For the seed and tests: signs every pending signature on a contract as its signer. */
export async function signAllForSeed(db: DB, tenantId: string, contractId: string, at: Date) {
  const sigs = await db.select().from(s.signatures).where(scope(s.signatures, tenantId, eq(s.signatures.contractId, contractId)));
  for (const x of sigs) await db.update(s.signatures).set({ status: "signed", signedAt: at, ipAddress: "10.0.0.24", userAgent: "Mozilla/5.0 (Macintosh)", tokenHash: null }).where(eq(s.signatures.id, x.id));
  return completeIfSigned(db, tenantId, contractId, "Signers", { inline: true, at });
}

export async function updatePayment(db: DB, actor: Actor, paymentId: string, i: { status: "paid" | "waived" | "due" | "overdue"; reference?: string }) {
  const [p] = await db.select().from(s.paymentsSchedule).where(scope(s.paymentsSchedule, actor.tenantId, eq(s.paymentsSchedule.id, paymentId)));
  if (!p) throw new DomainError("Payment not found.", 404);
  const [u] = await db.update(s.paymentsSchedule).set({ status: i.status, paidAt: i.status === "paid" ? new Date() : null, reference: i.reference ?? p.reference }).where(eq(s.paymentsSchedule.id, p.id)).returning();
  return { before: p, after: u! };
}

export async function updateChecklistItem(db: DB, actor: Actor, itemId: string, status: "open" | "in_progress" | "done" | "waived") {
  const [it] = await db.select().from(s.closingChecklists).where(scope(s.closingChecklists, actor.tenantId, eq(s.closingChecklists.id, itemId)));
  if (!it) throw new DomainError("Checklist item not found.", 404);
  const [u] = await db.update(s.closingChecklists).set({ status, completedAt: status === "done" ? new Date() : null }).where(eq(s.closingChecklists.id, it.id)).returning();
  return { before: it, after: u! };
}

/** Closes a deal as won. Requires a signed contract and no open CRITICAL checklist item; raises deal.closed, which starts the commission chain. */
export async function closeDeal(db: DB, actor: Actor, dealId: string, opts: { inline?: boolean; at?: Date; force?: boolean } = {}) {
  const d = await dealOr404(db, actor.tenantId, dealId);
  if (d.status !== "active") throw new DomainError("Only an active deal can be closed.");
  const [signed] = await db.select({ id: s.contracts.id }).from(s.contracts).where(scope(s.contracts, actor.tenantId, eq(s.contracts.dealId, dealId), eq(s.contracts.status, "signed"))).limit(1);
  if (!signed) throw new DomainError("A signed contract is required before the deal can close.");
  const critical = await db.select({ item: s.closingChecklists.item }).from(s.closingChecklists).where(scope(s.closingChecklists, actor.tenantId, eq(s.closingChecklists.dealId, dealId), eq(s.closingChecklists.severity, "CRITICAL"), inArray(s.closingChecklists.status, ["open", "in_progress"])));
  if (critical.length && !opts.force) throw new DomainError(`${critical.length} critical checklist items are open: ${critical.slice(0, 2).map((c) => c.item).join("; ")}.`);
  const at = opts.at ?? new Date();
  await setStage(db, actor, dealId, "closed", undefined, at);
  const [u] = await db.update(s.deals).set({ status: "won", actualCloseDate: isoDay(at), probability: 1 }).where(eq(s.deals.id, dealId)).returning();
  await publish(db, { type: "deal.closed", tenantId: actor.tenantId, entityType: "deal", entityId: dealId, dealId, clientId: d.clientId, mandateId: d.mandateId, actor: actor.name, payload: { label: `${d.reference}: ${d.title} closed at ${formatLocal(d.value, d.currency)}`, href: `/analyst/deals/${dealId}` }, at }, { inline: opts.inline });
  return u!;
}

export async function loseDeal(db: DB, actor: Actor, dealId: string, reason: string) {
  const d = await dealOr404(db, actor.tenantId, dealId);
  const [u] = await db.update(s.deals).set({ status: "lost", lostReason: reason, probability: 0 }).where(eq(s.deals.id, d.id)).returning();
  return { before: d, after: u! };
}

/* ----------------------------------------------------------------- reads */

export async function listDeals(db: DB, tenantId: string, f: { clientId?: string; status?: "active" | "won" | "lost" | "on_hold" } = {}) {
  return db
    .select({ deal: s.deals, client: s.clients.name, property: s.properties.name, city: s.properties.city, owner: s.users.name })
    .from(s.deals)
    .innerJoin(s.clients, eq(s.clients.id, s.deals.clientId))
    .innerJoin(s.properties, eq(s.properties.id, s.deals.propertyId))
    .leftJoin(s.users, eq(s.users.id, s.deals.ownerUserId))
    .where(scope(s.deals, tenantId, f.clientId ? eq(s.deals.clientId, f.clientId) : undefined, f.status ? eq(s.deals.status, f.status) : undefined))
    .orderBy(desc(s.deals.updatedAt));
}

export async function getDeal(db: DB, tenantId: string, dealId: string) {
  const [row] = await db
    .select({ deal: s.deals, client: s.clients, property: s.properties, owner: s.users.name })
    .from(s.deals)
    .innerJoin(s.clients, eq(s.clients.id, s.deals.clientId))
    .innerJoin(s.properties, eq(s.properties.id, s.deals.propertyId))
    .leftJoin(s.users, eq(s.users.id, s.deals.ownerUserId))
    .where(scope(s.deals, tenantId, eq(s.deals.id, dealId)));
  if (!row) return null;
  const w = <T extends typeof s.offers | typeof s.negotiations | typeof s.contracts | typeof s.closingChecklists | typeof s.paymentsSchedule | typeof s.dealStages>(t: T) => scope(t, tenantId, eq(t.dealId, dealId));
  const [stages, offers, rounds, contracts, checklist, payments] = await Promise.all([
    db.select().from(s.dealStages).where(w(s.dealStages)).orderBy(asc(s.dealStages.order)),
    db.select().from(s.offers).where(w(s.offers)).orderBy(asc(s.offers.createdAt)),
    db.select().from(s.negotiations).where(w(s.negotiations)).orderBy(asc(s.negotiations.roundNumber)),
    db.select().from(s.contracts).where(w(s.contracts)).orderBy(desc(s.contracts.createdAt)),
    db.select().from(s.closingChecklists).where(w(s.closingChecklists)).orderBy(asc(s.closingChecklists.sort)),
    db.select().from(s.paymentsSchedule).where(w(s.paymentsSchedule)).orderBy(asc(s.paymentsSchedule.dueDate)),
  ]);
  const signatures = contracts.length ? await db.select().from(s.signatures).where(scope(s.signatures, tenantId, inArray(s.signatures.contractId, contracts.map((c) => c.id)))) : [];
  const events = await db.select().from(s.osEvents).where(scope(s.osEvents, tenantId, eq(s.osEvents.dealId, dealId))).orderBy(asc(s.osEvents.createdAt));
  return { ...row, stages, offers, rounds, contracts, signatures, checklist, payments, events };
}
export type DealDetail = NonNullable<Awaited<ReturnType<typeof getDeal>>>;
