import "server-only";
import { and, eq, inArray, isNull, lt, ne, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";

export interface QualityCheck {
  check: string;
  table: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  count: number;
  examples: string[];
  fix: string;
}

/** Record-level checks across the workspace: gaps that weaken agents, compliance or reporting. */
export async function scanDataQuality(db: DB, tenantId: string): Promise<QualityCheck[]> {
  const t = (table: { tenantId: unknown }) => eq(table.tenantId as typeof s.clients.tenantId, tenantId);
  const today = new Date().toISOString().slice(0, 10);
  const [noKyc, staleDeals, noIndiaRecord, overdue, noEmbedding, unparsed, noGoals, noOwner] = await Promise.all([
    db.select({ name: s.clients.name }).from(s.clients).leftJoin(s.kycRecords, eq(s.kycRecords.clientId, s.clients.id)).where(and(t(s.clients), sql`(${s.kycRecords.id} is null or ${s.kycRecords.status} not in ('verified','in_review'))`)),
    db.select({ name: s.deals.reference }).from(s.deals).where(and(t(s.deals), eq(s.deals.status, "active"), lt(s.deals.targetCloseDate, today))),
    db.select({ name: s.properties.name }).from(s.properties).leftJoin(s.indiaPropertyRecords, eq(s.indiaPropertyRecords.propertyId, s.properties.id)).where(and(t(s.properties), eq(s.properties.market, "India"), inArray(s.properties.region, ["Maharashtra", "Goa"]), isNull(s.indiaPropertyRecords.id))),
    db.select({ name: s.invoices.number }).from(s.invoices).where(and(t(s.invoices), eq(s.invoices.status, "overdue"))),
    db.select({ name: s.documents.title }).from(s.documents).where(and(t(s.documents), isNull(s.documents.embedding))),
    db.select({ name: s.documents.title }).from(s.documents).where(and(t(s.documents), eq(s.documents.contentText, ""), ne(s.documents.type, "memo"))),
    db.select({ name: s.clients.name }).from(s.clients).leftJoin(s.clientGoals, eq(s.clientGoals.clientId, s.clients.id)).where(and(t(s.clients), isNull(s.clientGoals.id))),
    db.select({ name: s.deals.reference }).from(s.deals).where(and(t(s.deals), eq(s.deals.status, "active"), isNull(s.deals.ownerUserId))),
  ]);
  const mk = (check: string, table: string, severity: QualityCheck["severity"], rows: { name: string }[], fix: string): QualityCheck => ({ check, table, severity, count: rows.length, examples: rows.slice(0, 3).map((r) => r.name), fix });
  return [
    mk("Clients without verified KYC", "kyc_records", "HIGH", noKyc, "Request documents through the portal and complete review in Administration → KYC."),
    mk("Active deals past their target close date", "deals", "MEDIUM", staleDeals, "Update the target date or mark the deal lost with a reason."),
    mk("Mumbai and Goa properties without a register record", "india_property_records", "MEDIUM", noIndiaRecord, "Add the RERA, survey and zoning facts so the India agents can run."),
    mk("Overdue invoices", "invoices", "MEDIUM", overdue, "Run the collection agent and chase per its plan."),
    mk("Documents without search embeddings", "documents", "LOW", noEmbedding, "Re-upload or re-index so comparables and the assistant can find them."),
    mk("Documents without extracted text", "documents", "LOW", unparsed, "Upload a text-layer PDF or run OCR."),
    mk("Clients without goals", "client_goals", "LOW", noGoals, "Agree income and liquidity goals at the next review."),
    mk("Active deals without an owner", "deals", "MEDIUM", noOwner, "Assign an owner so commission splits resolve."),
  ].filter((c) => c.count > 0);
}
