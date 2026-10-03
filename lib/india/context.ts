import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { jurisdictionOf } from "@/lib/regulations";
import type { BuyerFacts, JurisdictionId, PropertyFacts } from "@/lib/regulations/types";
import { scope } from "@/lib/tenant-db";

export type IndiaRecord = typeof s.indiaPropertyRecords.$inferSelect;

/** Everything the India sources, agents and pages need about one property, tenant-scoped. */
export async function loadIndiaContext(db: DB, tenantId: string, propertyId: string) {
  const [property] = await db.select().from(s.properties).where(scope(s.properties, tenantId, eq(s.properties.id, propertyId))).limit(1);
  if (!property) return null;
  const [developer] = await db.select().from(s.developers).where(scope(s.developers, tenantId, eq(s.developers.id, property.developerId))).limit(1);
  const [record] = await db.select().from(s.indiaPropertyRecords).where(scope(s.indiaPropertyRecords, tenantId, eq(s.indiaPropertyRecords.propertyId, propertyId))).limit(1);
  const complaints = await db.select().from(s.reraComplaints).where(scope(s.reraComplaints, tenantId, eq(s.reraComplaints.developerId, property.developerId))).orderBy(desc(s.reraComplaints.filedOn));
  const land = await db.select().from(s.landRecords).where(scope(s.landRecords, tenantId, eq(s.landRecords.propertyId, propertyId))).orderBy(desc(s.landRecords.createdAt));
  const txs = await db.select().from(s.transactions).where(scope(s.transactions, tenantId, eq(s.transactions.propertyId, propertyId))).orderBy(desc(s.transactions.transactedAt));
  return { property, developer: developer ?? null, record: record ?? null, complaints, land, txs, jurisdiction: jurisdictionOf(property.city, property.market === "India" ? "India" : "UAE") as JurisdictionId };
}
export type IndiaContext = NonNullable<Awaited<ReturnType<typeof loadIndiaContext>>>;

export async function listIndiaProperties(db: DB, tenantId: string, state?: "MH" | "GA") {
  const rows = await db
    .select({ property: s.properties, record: s.indiaPropertyRecords, developer: s.developers })
    .from(s.indiaPropertyRecords)
    .innerJoin(s.properties, eq(s.properties.id, s.indiaPropertyRecords.propertyId))
    .innerJoin(s.developers, eq(s.developers.id, s.properties.developerId))
    .where(scope(s.indiaPropertyRecords, tenantId, state ? eq(s.indiaPropertyRecords.state, state) : undefined, eq(s.properties.tenantId, tenantId)))
    .orderBy(s.properties.name);
  return rows;
}

export async function complaintsFor(db: DB, tenantId: string, authority?: "MahaRERA" | "Goa RERA") {
  return db
    .select({ complaint: s.reraComplaints, developer: s.developers.name, property: s.properties.name })
    .from(s.reraComplaints)
    .innerJoin(s.developers, eq(s.developers.id, s.reraComplaints.developerId))
    .leftJoin(s.properties, eq(s.properties.id, s.reraComplaints.propertyId))
    .where(scope(s.reraComplaints, tenantId, authority ? eq(s.reraComplaints.authority, authority) : undefined))
    .orderBy(desc(s.reraComplaints.filedOn));
}

export async function landRecordsFor(db: DB, tenantId: string, state?: "MH" | "GA") {
  return db
    .select({ land: s.landRecords, property: s.properties.name, propertyId: s.properties.id, region: s.properties.region })
    .from(s.landRecords)
    .innerJoin(s.properties, eq(s.properties.id, s.landRecords.propertyId))
    .where(scope(s.landRecords, tenantId, state ? and(eq(s.properties.region, state === "MH" ? "Maharashtra" : "Goa")) : undefined))
    .orderBy(desc(s.landRecords.createdAt));
}

/** Rules-engine facts for a representative unit (the entry price) of a property. */
export function propertyFacts(c: Pick<IndiaContext, "property" | "record" | "jurisdiction">, value?: number): PropertyFacts {
  const p = c.property;
  const r = c.record;
  const v = value ?? p.priceMin;
  const carpet = r?.carpetAreaSqm ?? Math.round((v / p.pricePerSqft) * 0.0929 * 0.78);
  return {
    jurisdiction: c.jurisdiction,
    value: v,
    currency: p.currency === "INR" ? "INR" : "AED",
    governmentValue: r?.readyReckonerRate ? Math.round(r.readyReckonerRate * carpet * 1.2) : undefined,
    propertyType: /commercial/i.test(p.assetClass) ? "commercial" : /land|plot/i.test(p.assetClass) ? "land" : "residential",
    underConstruction: p.status !== "ready",
    carpetAreaSqm: carpet,
    coOpSociety: Boolean(r?.societyName),
    landUse: r?.landUse ?? undefined,
    crzZone: r?.crzZone ?? undefined,
    comunidade: r?.comunidade ?? false,
    mundkarStatus: r?.mundkarStatus ?? undefined,
    conversionStatus: r?.conversionStatus ?? undefined,
    reraRegistered: r ? r.reraStatus !== "lapsed" && r.reraStatus !== "revoked" : undefined,
    offPlan: p.status === "off_plan",
  };
}

/** Maps a client record to buyer facts for the rules engine. */
export function buyerFacts(client: { residency: string; nationality: string; type: string }, gender: BuyerFacts["gender"] = "male"): BuyerFacts {
  const r = client.residency.toLowerCase();
  const residency: BuyerFacts["residency"] = /company|family office|llc|trust/i.test(client.type) && !/hnwi/i.test(client.type) ? "company" : /nri/.test(r) ? "nri" : /oci/.test(r) ? "oci" : /india/.test(r) || /indian/i.test(client.nationality) && !/uae/.test(r) ? "resident_indian" : /uae/.test(r) ? (/indian/i.test(client.nationality) ? "nri" : "uae_resident") : "foreign_national";
  return { gender, residency };
}
