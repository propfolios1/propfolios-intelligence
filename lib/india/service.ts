import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { embed } from "@/lib/ai/embed";
import { DomainError } from "@/lib/errors";
import { goaLandUse, indiaTaxAdvisor, mahareraCompliance, nriWorkflow, readyReckoner } from "@/lib/ai/os-agents/india";
import { pluginFor } from "@/lib/regulations";
import type { BuyerFacts, JurisdictionId, SellerFacts } from "@/lib/regulations/types";
import { scope } from "@/lib/tenant-db";
import { buyerFacts, loadIndiaContext, propertyFacts } from "./context";
import { type LandRecordKind, parseLandRecord } from "./parsers";
import { lookupAll } from "./sources";

type Actor = { tenantId: string; name: string };
const ctxOf = (u: Actor) => ({ tenantId: u.tenantId, actor: u.name });

export class IndiaError extends DomainError {}

/** Rules-engine quote: stamp duty, registration, GST, TDS and capital gains, checklists and validation. */
export function taxQuote(q: { jurisdiction: JurisdictionId; value: number; governmentValue?: number; propertyType?: "residential" | "commercial" | "land"; underConstruction?: boolean; affordable?: boolean; buyer: BuyerFacts; seller?: SellerFacts; buyerBrokeragePct?: number; coOpSociety?: boolean; landUse?: "settlement" | "orchard" | "agricultural" | "conservation" | "commercial" | "industrial"; crzZone?: "none" | "CRZ-I" | "CRZ-II" | "CRZ-III" | "CRZ-IV"; mundkarStatus?: "none" | "claimed" | "declared" | "settled"; comunidade?: boolean; conversionStatus?: "not_required" | "sanad_obtained" | "applied" | "required" }) {
  const plugin = pluginFor(q.jurisdiction);
  const property = { jurisdiction: q.jurisdiction, value: q.value, currency: plugin.currency, governmentValue: q.governmentValue, propertyType: q.propertyType ?? "residential", underConstruction: q.underConstruction ?? false, affordable: q.affordable, coOpSociety: q.coOpSociety, landUse: q.landUse, crzZone: q.crzZone, mundkarStatus: q.mundkarStatus, comunidade: q.comunidade, conversionStatus: q.conversionStatus } as const;
  const tx = { property, buyer: q.buyer, seller: q.seller, buyerBrokeragePct: q.buyerBrokeragePct };
  return {
    plugin: { id: plugin.id, name: plugin.name, ratesAsOf: plugin.ratesAsOf, sources: plugin.sources },
    stampDuty: plugin.calculateStampDuty(property, q.buyer),
    breakdown: plugin.getTaxImplications(tx, q.buyer.residency),
    validation: plugin.validateTransaction(tx),
    registration: plugin.getRegistrationRequirements(property),
    checklist: plugin.getComplianceChecklist(q.underConstruction ? "off_plan" : q.coOpSociety ? "co_op_resale" : q.propertyType === "land" ? "land" : "purchase"),
  };
}

async function contextOrThrow(db: DB, tenantId: string, propertyId: string) {
  const c = await loadIndiaContext(db, tenantId, propertyId);
  if (!c?.record) throw new IndiaError("This property has no India record in your workspace.");
  return c;
}

export async function runMahareraCompliance(db: DB, u: Actor, propertyId: string) {
  const { ctx, results } = await lookupAll(db, u.tenantId, propertyId);
  if (!ctx?.record || ctx.record.state !== "MH") throw new IndiaError("MahaRERA compliance applies to Maharashtra properties.");
  return mahareraCompliance.run(
    {
      property: { id: ctx.property.id, name: ctx.property.name, developer: ctx.developer?.name ?? "Developer", developerId: ctx.property.developerId, status: ctx.property.status, reraNumber: ctx.record.reraNumber },
      sources: results.map((r) => ({ label: r.label, summary: r.summary, flags: r.flags, found: r.found })),
      complaints: ctx.complaints.filter((c) => c.authority === "MahaRERA").map((c) => ({ category: c.category, status: c.status, filedOn: c.filedOn })),
    },
    ctxOf(u),
  );
}

export async function runGoaLandUse(db: DB, u: Actor, propertyId: string, buyerResidency = "resident_indian", purpose: "residential" | "holiday_home" | "land_bank" = "holiday_home") {
  const c = await contextOrThrow(db, u.tenantId, propertyId);
  if (c.record!.state !== "GA") throw new IndiaError("The Goa land use assessment applies to Goa properties.");
  const r = c.record!;
  return goaLandUse.run(
    {
      property: { id: c.property.id, name: c.property.name, village: r.village, purpose },
      buyerResidency,
      facts: { landUse: r.landUse, rp2021Zone: r.rp2021Zone, crzZone: r.crzZone, comunidade: r.comunidade, comunidadeName: r.comunidadeName, mundkarStatus: r.mundkarStatus, conversionStatus: r.conversionStatus, conversionDays: r.conversionDays },
      titleHistory: r.titleHistory,
      recordWarnings: c.land.flatMap((l) => l.warnings),
    },
    ctxOf(u),
  );
}

export async function runReadyReckoner(db: DB, u: Actor, propertyId: string, agreementValue?: number) {
  const c = await contextOrThrow(db, u.tenantId, propertyId);
  const r = c.record!;
  const facts = propertyFacts(c, agreementValue);
  return readyReckoner.run(
    {
      propertyId: c.property.id,
      propertyName: c.property.name,
      zone: r.readyReckonerZone ?? "Not mapped",
      year: r.readyReckonerYear ?? new Date().getFullYear(),
      ratePerSqm: r.readyReckonerRate ?? 0,
      carpetAreaSqm: facts.carpetAreaSqm ?? 0,
      agreementValue: facts.value,
      governmentValue: facts.governmentValue ?? facts.value,
      comparablesPerSqm: c.txs.map((t) => Math.round(t.pricePerSqft * 10.764)),
    },
    ctxOf(u),
  );
}

export async function runTaxAdvisor(db: DB, u: Actor, args: { propertyId?: string; clientId?: string | null; quote: Parameters<typeof taxQuote>[0] }) {
  const q = taxQuote(args.quote);
  if (args.quote.jurisdiction !== "mumbai" && args.quote.jurisdiction !== "maharashtra" && args.quote.jurisdiction !== "goa") throw new IndiaError("The India tax advisor covers Mumbai, Maharashtra and Goa.");
  const run = await indiaTaxAdvisor.run({ jurisdiction: args.quote.jurisdiction, value: args.quote.value, buyer: args.quote.buyer, seller: args.quote.seller ?? null, breakdown: { lines: q.breakdown.lines.map((l) => ({ label: l.label, payer: l.payer, amount: l.amount, reference: l.reference })), buyerTotal: q.breakdown.buyerTotal, sellerTotal: q.breakdown.sellerTotal, buyerCostPct: q.breakdown.buyerCostPct, notes: q.breakdown.notes }, clientId: args.clientId ?? null }, ctxOf(u));
  return { quote: q, run };
}

export async function runNriWorkflow(db: DB, u: Actor, args: { clientId: string; propertyId: string; side: "buy" | "sell"; canTravel: boolean; fundedFrom: "nre" | "nro" | "fcnr" | "inward_remittance" | "mixed" }) {
  const [client] = await db.select().from(s.clients).where(scope(s.clients, u.tenantId, eq(s.clients.id, args.clientId)));
  if (!client) throw new IndiaError("Client not found.");
  const c = await contextOrThrow(db, u.tenantId, args.propertyId);
  const j = c.jurisdiction === "goa" ? "goa" : c.jurisdiction === "mumbai" ? "mumbai" : "maharashtra";
  return nriWorkflow.run({ client: { id: client.id, name: client.name, residency: client.residency, nationality: client.nationality, canTravel: args.canTravel }, side: args.side, jurisdiction: j, propertyName: c.property.name, valueInr: c.property.priceMin, landUse: c.record!.landUse, fundedFrom: args.fundedFrom }, ctxOf(u));
}

/** Parses an uploaded or pasted land record and files it against the property. */
export async function fileLandRecord(db: DB, u: Actor & { id?: string }, args: { propertyId: string; text: string; kind?: LandRecordKind | null; method: "text" | "pdf_text" | "ocr"; title?: string }) {
  const [prop] = await db.select({ id: s.properties.id, name: s.properties.name }).from(s.properties).where(scope(s.properties, u.tenantId, eq(s.properties.id, args.propertyId)));
  if (!prop) throw new IndiaError("Property not found.");
  const parsed = parseLandRecord(args.text, args.kind, { ocr: args.method === "ocr" });
  if (!parsed) throw new IndiaError("The record type could not be recognised. Choose 7/12, property card, Form I and XIV or Comunidade.");
  const [doc] = await db.insert(s.documents).values({ tenantId: u.tenantId, propertyId: prop.id, title: args.title ?? `Land record: ${prop.name}`, type: "land_record", pages: 1, sizeBytes: args.text.length, contentText: args.text, extractedData: parsed.parsed, embedding: embed(args.text) }).returning({ id: s.documents.id });
  const [row] = await db.insert(s.landRecords).values({ tenantId: u.tenantId, propertyId: prop.id, documentId: doc!.id, recordType: parsed.recordType, parsed: parsed.parsed as unknown as Record<string, unknown>, confidence: parsed.confidence, parser: args.method === "ocr" ? "ocr" : "text", warnings: parsed.warnings, sourceText: args.text, embedding: embed(args.text) }).returning();
  return { record: row!, parsed };
}

export async function clientIndiaHoldings(db: DB, tenantId: string, clientId: string) {
  return db
    .select({ portfolio: s.portfolios, property: s.properties, record: s.indiaPropertyRecords })
    .from(s.portfolios)
    .innerJoin(s.properties, eq(s.properties.id, s.portfolios.propertyId))
    .leftJoin(s.indiaPropertyRecords, and(eq(s.indiaPropertyRecords.propertyId, s.properties.id), eq(s.indiaPropertyRecords.tenantId, tenantId)))
    .where(scope(s.portfolios, tenantId, eq(s.portfolios.clientId, clientId), eq(s.properties.market, "India")));
}

export { buyerFacts };
