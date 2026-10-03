import "server-only";
import { and, asc, eq, inArray, lte } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { KycDocument } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { scope } from "@/lib/tenant-db";

type DocType = KycDocument["type"];

/** Documents required by residency, under the UAE AML regime (Cabinet Resolution 10 of 2019) and India's PMLA KYC norms for NRIs. */
export function requiredDocuments(client: { residency: string; nationality: string; type: string }): DocType[] {
  const r = client.residency.toLowerCase();
  const docs: DocType[] = ["passport", "proof_of_address", "source_of_funds"];
  if (/uae/.test(r)) docs.splice(1, 0, "emirates_id");
  if (/nri|india/.test(r) || /indian/i.test(client.nationality)) docs.push("pan");
  if (/oci/.test(r)) docs.push("oci_card");
  return docs;
}

export const DOC_LABEL: Record<DocType, string> = { passport: "Passport", emirates_id: "Emirates ID", proof_of_address: "Proof of address (within three months)", source_of_funds: "Source of funds declaration and evidence", pan: "PAN card", aadhaar: "Aadhaar", oci_card: "OCI card" };

/** Risk rating: high for PEPs, unverifiable funds or AED 50M+ with cross-border flows; low for verified UAE residents under AED 10M. */
export function riskLevel(c: { aumAed: number; residency: string }, k: { pep: boolean; sourceOfFunds: string | null }) {
  if (k.pep || !k.sourceOfFunds) return "high" as const;
  if (c.aumAed >= 50_000_000 || /nri/i.test(c.residency)) return "medium" as const;
  return c.aumAed < 10_000_000 ? ("low" as const) : ("medium" as const);
}

export async function ensureKyc(db: DB, tenantId: string, clientId: string) {
  const [existing] = await db.select().from(s.kycRecords).where(scope(s.kycRecords, tenantId, eq(s.kycRecords.clientId, clientId)));
  if (existing) return existing;
  const [c] = await db.select().from(s.clients).where(scope(s.clients, tenantId, eq(s.clients.id, clientId)));
  if (!c) throw new DomainError("Client not found.", 404);
  const [row] = await db
    .insert(s.kycRecords)
    .values({ tenantId, clientId, status: "not_started", documents: requiredDocuments(c).map((type) => ({ type, documentId: null, status: "missing" as const, expiresAt: null })), riskLevel: riskLevel(c, { pep: false, sourceOfFunds: null }) })
    .onConflictDoNothing()
    .returning();
  return row ?? (await db.select().from(s.kycRecords).where(scope(s.kycRecords, tenantId, eq(s.kycRecords.clientId, clientId))))[0]!;
}

export async function updateKycDocument(db: DB, tenantId: string, clientId: string, d: { type: DocType; status: KycDocument["status"]; documentId?: string | null; expiresAt?: string | null }) {
  const k = await ensureKyc(db, tenantId, clientId);
  const docs = k.documents.some((x) => x.type === d.type) ? k.documents.map((x) => (x.type === d.type ? { ...x, status: d.status, documentId: d.documentId ?? x.documentId, expiresAt: d.expiresAt ?? x.expiresAt } : x)) : [...k.documents, { type: d.type, status: d.status, documentId: d.documentId ?? null, expiresAt: d.expiresAt ?? null }];
  const status = k.status === "verified" ? "verified" : docs.every((x) => x.status === "verified") ? "in_review" : docs.some((x) => x.status !== "missing") ? "pending" : "not_started";
  const [u] = await db.update(s.kycRecords).set({ documents: docs, status }).where(eq(s.kycRecords.id, k.id)).returning();
  return { before: k, after: u! };
}

/** Verification decision. A verified record expires at the earliest document expiry or after two years. */
export async function decideKyc(db: DB, tenantId: string, clientId: string, d: { decision: "verified" | "rejected"; by: string; pep?: boolean; sourceOfFunds?: string | null; notes?: string }) {
  const k = await ensureKyc(db, tenantId, clientId);
  const [c] = await db.select().from(s.clients).where(eq(s.clients.id, clientId));
  if (d.decision === "verified" && k.documents.some((x) => x.status !== "verified")) throw new DomainError("Every required document must be verified first.");
  const now = new Date();
  const earliest = k.documents.map((x) => x.expiresAt).filter((x): x is string => !!x).sort()[0];
  const twoYears = new Date(now.getTime() + 730 * 86_400_000);
  const expires = earliest && new Date(earliest) < twoYears ? new Date(earliest) : twoYears;
  const pep = d.pep ?? k.pep;
  const sof = d.sourceOfFunds ?? k.sourceOfFunds;
  const [u] = await db
    .update(s.kycRecords)
    .set({ status: d.decision, verifiedAt: d.decision === "verified" ? now : null, verifiedBy: d.by, expiresAt: d.decision === "verified" ? expires : null, pep, sourceOfFunds: sof, notes: d.notes ?? k.notes, riskLevel: riskLevel(c!, { pep, sourceOfFunds: sof }) })
    .where(eq(s.kycRecords.id, k.id))
    .returning();
  await db.update(s.clients).set({ kycStatus: d.decision === "verified" ? "verified" : "rejected" }).where(eq(s.clients.id, clientId));
  return { before: k, after: u! };
}

/** Verified records expiring within `days` (and any already expired are marked expired). */
export async function expiringKyc(db: DB, tenantId: string, days: number) {
  const now = new Date();
  const lapsed = await db.update(s.kycRecords).set({ status: "expired" }).where(and(scope(s.kycRecords, tenantId, eq(s.kycRecords.status, "verified")), lte(s.kycRecords.expiresAt, now))).returning({ clientId: s.kycRecords.clientId });
  if (lapsed.length) await db.update(s.clients).set({ kycStatus: "expired" }).where(and(eq(s.clients.tenantId, tenantId), inArray(s.clients.id, lapsed.map((l) => l.clientId))));
  const until = new Date(now.getTime() + days * 86_400_000);
  return db.select({ kyc: s.kycRecords, client: s.clients.name }).from(s.kycRecords).innerJoin(s.clients, eq(s.clients.id, s.kycRecords.clientId)).where(and(scope(s.kycRecords, tenantId), lte(s.kycRecords.expiresAt, until))).orderBy(asc(s.kycRecords.expiresAt));
}

export async function listKyc(db: DB, tenantId: string) {
  return db.select({ kyc: s.kycRecords, client: s.clients }).from(s.kycRecords).innerJoin(s.clients, eq(s.clients.id, s.kycRecords.clientId)).where(scope(s.kycRecords, tenantId)).orderBy(asc(s.clients.name));
}
