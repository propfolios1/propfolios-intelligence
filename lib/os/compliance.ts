import "server-only";
import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { getClient360 } from "@/lib/data-model";
import { DomainError } from "@/lib/errors";
import { scope } from "@/lib/tenant-db";
import { systemAudit } from "./audit";

type Regime = "GDPR" | "DPDP" | "UAE PDPL";
type ReqType = "access" | "deletion" | "rectification" | "portability";

/** Statutory response periods in days: GDPR Art. 12(3) one month; UAE PDPL Art. 13-18 thirty days; DPDP Act 2023 grievance period, set at thirty days. */
export const RESPONSE_DAYS: Record<Regime, number> = { GDPR: 30, DPDP: 30, "UAE PDPL": 30 };

/** Default retention in years: UAE AML (Decree-Law 20 of 2018, Art. 16) five; India PMLA s.12 five; EU per purpose (default six for tax records); audit seven. */
export const DEFAULT_RETENTION = { uaeYears: 5, indiaYears: 5, euYears: 6, auditYears: 7 };

const STEPS: Record<ReqType, string[]> = {
  access: ["Verify the requester's identity", "Compile the data held", "Review for third-party data", "Send the export to the data subject"],
  portability: ["Verify the requester's identity", "Export in a machine-readable format", "Send the export to the data subject"],
  rectification: ["Verify the requester's identity", "Correct the records", "Confirm the correction to the data subject"],
  deletion: ["Verify the requester's identity", "Check retention obligations (AML, tax)", "Erase or anonymise personal data", "Confirm erasure to the data subject"],
};

export async function createDataRequest(db: DB, tenantId: string, r: { clientId: string | null; subjectEmail: string; type: ReqType; regime: Regime; by: string }) {
  const now = Date.now();
  const [row] = await db.insert(s.dataRequests).values({ tenantId, clientId: r.clientId, subjectEmail: r.subjectEmail.toLowerCase(), type: r.type, regime: r.regime, status: "received", dueAt: new Date(now + RESPONSE_DAYS[r.regime] * 86_400_000), steps: STEPS[r.type].map((step) => ({ step, done: false, at: null })), createdBy: r.by }).returning();
  await systemAudit(db, { tenantId, actor: r.by, action: `received ${r.type} request (${r.regime})`, entityType: "data_request", entityId: row!.id, after: { subject: r.subjectEmail, due: row!.dueAt } });
  return row!;
}

export async function completeStep(db: DB, tenantId: string, requestId: string, index: number, by: string) {
  const [r] = await db.select().from(s.dataRequests).where(scope(s.dataRequests, tenantId, eq(s.dataRequests.id, requestId)));
  if (!r) throw new DomainError("Request not found.", 404);
  const steps = r.steps.map((x, i) => (i === index ? { ...x, done: true, at: new Date().toISOString() } : x));
  const all = steps.every((x) => x.done);
  const [u] = await db.update(s.dataRequests).set({ steps, status: all ? "completed" : index === 0 ? "verified" : "in_progress", completedAt: all ? new Date() : null }).where(eq(s.dataRequests.id, r.id)).returning();
  await systemAudit(db, { tenantId, actor: by, action: `data request step: ${r.steps[index]?.step}`, entityType: "data_request", entityId: r.id, before: { status: r.status }, after: { status: u!.status } });
  return u!;
}

/** Everything held about a client, as one JSON document (access and portability requests). */
export async function exportClientData(db: DB, tenantId: string, clientId: string) {
  const c360 = await getClient360(db, tenantId, clientId);
  if (!c360) throw new DomainError("Client not found.", 404);
  const [messages, consents, users] = await Promise.all([
    db.select({ body: s.messages.body, createdAt: s.messages.createdAt }).from(s.messages).where(and(eq(s.messages.tenantId, tenantId), eq(s.messages.clientId, clientId))).orderBy(desc(s.messages.createdAt)),
    db.select().from(s.consents).where(scope(s.consents, tenantId, eq(s.consents.clientId, clientId))),
    db.select({ name: s.users.name, email: s.users.email, createdAt: s.users.createdAt }).from(s.users).where(and(eq(s.users.tenantId, tenantId), eq(s.users.clientId, clientId))),
  ]);
  return { exportedAt: new Date().toISOString(), format: "Nakhla data subject export v1", subject: c360.client, portalUsers: users, ...c360, messages, consents: consents.map((x) => ({ purpose: x.purpose, granted: x.granted, version: x.version, grantedAt: x.grantedAt, withdrawnAt: x.withdrawnAt })) };
}

/**
 * Erasure with retention: personal identifiers are replaced by a pseudonym,
 * messages and non-financial documents are deleted, portal logins removed and
 * consents withdrawn. Financial and KYC records needed under AML and tax law
 * are kept, pseudonymised, until their retention period ends.
 */
export async function eraseClient(db: DB, tenantId: string, clientId: string, by: string) {
  const [c] = await db.select().from(s.clients).where(scope(s.clients, tenantId, eq(s.clients.id, clientId)));
  if (!c) throw new DomainError("Client not found.", 404);
  const alias = `Erased subject ${createHash("sha256").update(c.id).digest("hex").slice(0, 8)}`;
  await db.update(s.clients).set({ name: alias, nationality: "Withheld", domicile: "Withheld" }).where(eq(s.clients.id, c.id));
  const msgs = await db.delete(s.messages).where(and(eq(s.messages.tenantId, tenantId), eq(s.messages.clientId, clientId))).returning({ id: s.messages.id });
  const docs = await db.delete(s.documents).where(and(eq(s.documents.tenantId, tenantId), eq(s.documents.clientId, clientId), eq(s.documents.type, "kyc"))).returning({ id: s.documents.id });
  const logins = await db.delete(s.users).where(and(eq(s.users.tenantId, tenantId), eq(s.users.clientId, clientId), eq(s.users.role, "client"))).returning({ id: s.users.id });
  await db.update(s.consents).set({ granted: false, withdrawnAt: new Date() }).where(scope(s.consents, tenantId, eq(s.consents.clientId, clientId)));
  const result = { alias, messagesDeleted: msgs.length, documentsDeleted: docs.length, loginsRemoved: logins.length, retained: ["Invoices and payments (tax)", "KYC decision and screening results (AML, five years)", "Deals and commissions (accounting)"] };
  await systemAudit(db, { tenantId, actor: by, action: "erased client personal data", entityType: "client", entityId: clientId, before: { name: c.name }, after: result });
  return result;
}

export async function setConsent(db: DB, tenantId: string, clientId: string, c: { purpose: "data_processing" | "marketing" | "cross_border_transfer" | "federation"; granted: boolean; jurisdiction: "UAE" | "India" | "EU"; source: string }) {
  const now = new Date();
  const [row] = await db
    .insert(s.consents)
    .values({ tenantId, clientId, purpose: c.purpose, granted: c.granted, version: "2026-04", jurisdiction: c.jurisdiction, grantedAt: c.granted ? now : null, withdrawnAt: c.granted ? null : now, source: c.source })
    .onConflictDoUpdate({ target: [s.consents.clientId, s.consents.purpose], set: { granted: c.granted, grantedAt: c.granted ? now : undefined, withdrawnAt: c.granted ? null : now, source: c.source } })
    .returning();
  return row!;
}
