import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";
import { calcConfigSchema, type CalcConfigInput, calculate, MARKET_TAX } from "./calculator";
import { selectStructure, toAed, type StructureLike } from "./engine";
import { ensureDefaultStructures } from "./service";

type Structure = typeof s.commissionStructures.$inferSelect;

/** The tax regime of a deal's jurisdiction (UAE VAT; India GST with TDS on developer payments). */
export function taxFor(jurisdiction: string, currency: string) {
  if (jurisdiction === "dubai" || jurisdiction === "abu_dhabi") return MARKET_TAX.AED!;
  if (jurisdiction === "mumbai" || jurisdiction === "goa") return MARKET_TAX.INR!;
  return MARKET_TAX[currency] ?? { name: "Tax", ratePct: 0 };
}

/**
 * The calculator definition of a structure. A structure saved from the
 * calculator carries its own; an older structure (rate, tiers, splits) is
 * translated: the house line becomes the firm's share and the other lines
 * split the agents' share in the same proportions.
 */
export function configFromStructure(st: Pick<Structure, "type" | "ratePct" | "fixedAmount" | "currency" | "tiers" | "splits" | "payer" | "calc" | "name">, currency: string, tax: CalcConfigInput["tax"], owner?: { id: string | null; seniorId?: string | null }): CalcConfigInput {
  if (st.calc) return { ...st.calc, currency, tax: st.calc.tax ?? tax };
  const house = st.splits.filter((x) => x.role === "house" || /house|firm/i.test(x.label)).reduce((a, x) => a + x.pct, 0);
  const people = st.splits.filter((x) => !(x.role === "house" || /house|firm/i.test(x.label)));
  const pool = people.reduce((a, x) => a + x.pct, 0);
  const fixed = st.fixedAmount ?? 0;
  const fixedInDeal = st.currency && st.currency !== currency ? Math.round((toAed(fixed, st.currency) / toAed(1, currency)) * 100) / 100 : fixed;
  return {
    currency,
    fees: [{ label: `${st.payer.charAt(0).toUpperCase()}${st.payer.slice(1)}'s fee`, payer: st.payer, method: st.type === "percentage" ? "percentage" : st.type === "fixed" ? "fixed" : "tiered_marginal", ratePct: st.ratePct ?? undefined, fixedAmount: st.type === "fixed" ? fixedInDeal : undefined, tiers: st.type === "tiered" ? st.tiers : undefined }],
    deductions: [],
    agentSplitPct: house + pool > 0 ? Math.round((pool / (house + pool)) * 1_000_000) / 10_000 : 50,
    capRemaining: null,
    transactionFee: 0,
    team: people.map((x) => ({ label: x.label, pct: pool ? Math.round((x.pct / pool) * 1_000_000) / 10_000 : 0, userId: x.userId ?? (x.role === "senior_analyst" ? (owner?.seniorId ?? null) : (owner?.id ?? null)), role: x.role === "senior_analyst" ? ("team_lead" as const) : ("listing" as const) })),
    tax,
    installments: [],
  };
}

export const inputHash = (price: string, config: CalcConfigInput) => createHash("sha256").update(JSON.stringify({ price, config: calcConfigSchema.parse(config) })).digest("hex");

async function senior(db: DB, tenantId: string) {
  const staff = await db.select({ id: s.users.id, role: s.users.role, accessRole: s.users.accessRole }).from(s.users).where(scope(s.users, tenantId));
  return (staff.find((u) => u.accessRole === "senior_analyst" || u.accessRole === "tenant_owner") ?? staff.find((u) => u.role === "tenant_admin"))?.id ?? null;
}

/** Everything the deal's calculator needs: the deal, the structure that applies, its configuration, the firm's people and the saved scenarios. */
export async function dealCalculator(db: DB, tenantId: string, dealId: string) {
  const [deal] = await db.select().from(s.deals).where(scope(s.deals, tenantId, eq(s.deals.id, dealId)));
  if (!deal) throw new HttpError(404, "Deal not found.");
  await ensureDefaultStructures(db, tenantId);
  const structures = await db.select().from(s.commissionStructures).where(scope(s.commissionStructures, tenantId, eq(s.commissionStructures.active, true)));
  const st = selectStructure(structures as unknown as StructureLike[], deal) as unknown as Structure | null;
  const tax = taxFor(deal.jurisdiction, deal.currency);
  const owner = { id: deal.ownerUserId, seniorId: await senior(db, tenantId) };
  const base = st ? configFromStructure(st, deal.currency, tax, owner) : null;
  const [scenarios, people] = await Promise.all([
    db.select().from(s.commissionScenarios).where(scope(s.commissionScenarios, tenantId, eq(s.commissionScenarios.dealId, dealId))).orderBy(desc(s.commissionScenarios.selected), desc(s.commissionScenarios.updatedAt)),
    db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(scope(s.users, tenantId)).orderBy(s.users.name),
  ]);
  return { deal, structure: st, structures: structures.map((x) => ({ id: x.id, name: x.name, config: configFromStructure(x, deal.currency, tax, owner) })), base, scenarios, people: people.filter((p) => p.name) };
}

async function record(db: DB, tenantId: string, r: { dealId: string | null; scenarioId: string | null; structureId: string | null; purpose: (typeof s.commissionCalculations.$inferInsert)["purpose"]; price: string; config: CalcConfigInput; userId: string | null }) {
  const result = calculate(r.price, r.config);
  if (!result.balanced) throw new HttpError(500, "The calculation does not balance; nothing was saved.");
  const [row] = await db
    .insert(s.commissionCalculations)
    .values({ tenantId, dealId: r.dealId, scenarioId: r.scenarioId, structureId: r.structureId, purpose: r.purpose, engine: result.engine, inputHash: inputHash(r.price, r.config), price: r.price, config: r.config, result, grossMinor: result.gross, currency: result.currency, createdBy: r.userId })
    .returning();
  return { row: row!, result };
}

export async function saveScenario(db: DB, tenantId: string, user: { id: string }, dealId: string, b: { id?: string; name: string; price: string; config: CalcConfigInput; structureId?: string | null; select?: boolean }) {
  const [deal] = await db.select({ id: s.deals.id, currency: s.deals.currency }).from(s.deals).where(scope(s.deals, tenantId, eq(s.deals.id, dealId)));
  if (!deal) throw new HttpError(404, "Deal not found.");
  const config = { ...b.config, currency: deal.currency };
  let result;
  try {
    result = calculate(b.price, config);
  } catch (e) {
    throw new HttpError(422, `The calculation is not valid: ${(e as Error).message.slice(0, 200)}`);
  }
  if (b.select) await db.update(s.commissionScenarios).set({ selected: false }).where(scope(s.commissionScenarios, tenantId, eq(s.commissionScenarios.dealId, dealId)));
  const values = { name: b.name, price: b.price, config, result, structureId: b.structureId ?? null, ...(b.select ? { selected: true } : {}) };
  let row: typeof s.commissionScenarios.$inferSelect | undefined;
  if (b.id) [row] = await db.update(s.commissionScenarios).set(values).where(scope(s.commissionScenarios, tenantId, eq(s.commissionScenarios.id, b.id), eq(s.commissionScenarios.dealId, dealId))).returning();
  else [row] = await db.insert(s.commissionScenarios).values({ tenantId, dealId, createdBy: user.id, ...values }).returning();
  if (!row) throw new HttpError(404, "Scenario not found.");
  await record(db, tenantId, { dealId, scenarioId: row.id, structureId: row.structureId, purpose: b.select ? "scenario_selected" : "scenario_saved", price: b.price, config, userId: user.id });
  return row;
}

export async function selectScenario(db: DB, tenantId: string, user: { id: string }, dealId: string, scenarioId: string) {
  const [sc] = await db.select().from(s.commissionScenarios).where(scope(s.commissionScenarios, tenantId, eq(s.commissionScenarios.id, scenarioId), eq(s.commissionScenarios.dealId, dealId)));
  if (!sc) throw new HttpError(404, "Scenario not found.");
  await db.update(s.commissionScenarios).set({ selected: false }).where(scope(s.commissionScenarios, tenantId, eq(s.commissionScenarios.dealId, dealId)));
  await db.update(s.commissionScenarios).set({ selected: true }).where(eq(s.commissionScenarios.id, sc.id));
  await record(db, tenantId, { dealId, scenarioId: sc.id, structureId: sc.structureId, purpose: "scenario_selected", price: sc.price, config: sc.config, userId: user.id });
  return sc;
}

export async function deleteScenario(db: DB, tenantId: string, dealId: string, scenarioId: string) {
  const [sc] = await db.delete(s.commissionScenarios).where(and(scope(s.commissionScenarios, tenantId, eq(s.commissionScenarios.id, scenarioId)), eq(s.commissionScenarios.dealId, dealId))).returning();
  if (!sc) throw new HttpError(404, "Scenario not found.");
  return sc;
}

/** The selected scenario of a deal, recomputed (never trusted from storage) and recorded as the closing calculation. */
export async function closingCalculation(db: DB, tenantId: string, dealId: string, userId: string | null) {
  const [sc] = await db.select().from(s.commissionScenarios).where(scope(s.commissionScenarios, tenantId, eq(s.commissionScenarios.dealId, dealId), eq(s.commissionScenarios.selected, true)));
  if (!sc) return null;
  const { row, result } = await record(db, tenantId, { dealId, scenarioId: sc.id, structureId: sc.structureId, purpose: "deal_closed", price: sc.price, config: sc.config, userId });
  return { scenario: sc, calculation: row, result };
}

export async function saveStructureCalc(db: DB, tenantId: string, id: string, b: { name?: string; config: CalcConfigInput; payer?: "developer" | "seller" | "buyer" }) {
  const config = calcConfigSchema.parse(b.config);
  calculate("1000000", config);
  const first = config.fees[0]!;
  const legacy = {
    type: first.method === "percentage" ? ("percentage" as const) : first.method === "fixed" ? ("fixed" as const) : ("tiered" as const),
    ratePct: first.ratePct ?? null,
    fixedAmount: first.fixedAmount ?? null,
    tiers: first.tiers ?? [],
    payer: (first.payer === "landlord" ? "seller" : first.payer === "tenant" ? "buyer" : first.payer) as "developer" | "seller" | "buyer",
    splits: [{ label: "House", role: "house" as const, pct: Math.round((100 - config.agentSplitPct) * 100) / 100 }, ...(config.team.length ? config.team : [{ label: "Agent", pct: 100, role: "member" as const, userId: null }]).map((t) => ({ label: t.label, role: t.role === "team_lead" ? ("senior_analyst" as const) : ("analyst" as const), pct: Math.round(((config.agentSplitPct * t.pct) / 100) * 100) / 100, ...(t.userId ? { userId: t.userId } : {}) }))],
  };
  const [row] = await db
    .update(s.commissionStructures)
    .set({ ...legacy, calc: config, ...(b.name ? { name: b.name } : {}) })
    .where(scope(s.commissionStructures, tenantId, eq(s.commissionStructures.id, id)))
    .returning();
  if (!row) throw new HttpError(404, "Structure not found.");
  return row;
}

export async function calculationHistory(db: DB, tenantId: string, dealId: string) {
  return db
    .select({ c: s.commissionCalculations, by: s.users.name })
    .from(s.commissionCalculations)
    .leftJoin(s.users, eq(s.users.id, s.commissionCalculations.createdBy))
    .where(scope(s.commissionCalculations, tenantId, eq(s.commissionCalculations.dealId, dealId)))
    .orderBy(desc(s.commissionCalculations.createdAt))
    .limit(30);
}
