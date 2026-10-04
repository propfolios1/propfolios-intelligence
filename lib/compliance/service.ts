import "server-only";
import { and, desc, eq, inArray, isNotNull, lte, ne, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { KycDoc, SubjectType } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { notify } from "@/lib/os/notify";
import { scope } from "@/lib/tenant-db";
import { DEFAULT_HIGH_RISK, FIRM_RETENTION_YEARS, JURISDICTIONS, type JurisdictionCode, MARKET_JURISDICTION, type ReportType } from "./jurisdictions";
import { buildReport, type ReportInput, type ReportParty, type ReportTransaction } from "./reports";
import { screenSubject } from "./screening";

const DAY = 86_400_000;
const retain = (from = new Date()) => new Date(from.getTime() + FIRM_RETENTION_YEARS * 365.25 * DAY);
type Settings = NonNullable<s.TenantConfig["compliance"]>;

export async function complianceSettings(db: DB, tenantId: string): Promise<Settings & { firm: string }> {
  const [t] = await db.select({ name: s.tenants.name, cfg: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.id, tenantId));
  if (!t) throw new HttpError(404, "Workspace not found.");
  const [l] = await db.select({ market: s.listings.market }).from(s.listings).where(eq(s.listings.tenantId, tenantId)).limit(1);
  const [ld] = l ? [] : await db.select({ market: s.leads.market }).from(s.leads).where(eq(s.leads.tenantId, tenantId)).limit(1);
  const home = MARKET_JURISDICTION[l?.market ?? ld?.market ?? "AE"] ?? "AE";
  const c = t.cfg.compliance;
  return { firm: t.name, goamlEntityId: c?.goamlEntityId ?? null, mlroName: c?.mlroName ?? null, mlroEmail: c?.mlroEmail ?? null, highRiskCountries: c?.highRiskCountries ?? DEFAULT_HIGH_RISK, jurisdictions: c?.jurisdictions?.length ? c.jurisdictions : [home] };
}

export async function saveComplianceSettings(db: DB, tenantId: string, patch: Partial<Settings>) {
  const [t] = await db.select({ cfg: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.id, tenantId));
  const cur = await complianceSettings(db, tenantId);
  const next: Settings = { goamlEntityId: patch.goamlEntityId ?? cur.goamlEntityId, mlroName: patch.mlroName ?? cur.mlroName, mlroEmail: patch.mlroEmail ?? cur.mlroEmail, highRiskCountries: patch.highRiskCountries ?? cur.highRiskCountries, jurisdictions: patch.jurisdictions ?? cur.jurisdictions };
  await db.update(s.tenants).set({ configJson: { ...t!.cfg, compliance: next } }).where(eq(s.tenants.id, tenantId));
  return next;
}

/* -------------------------------------------------------------- screening */

export interface Subject {
  subjectType: SubjectType;
  subjectId?: string | null;
  name: string;
  entityType?: "person" | "company";
  birthDate?: string | null;
  nationality?: string | null;
  jurisdiction: JurisdictionCode;
}

export async function screen(db: DB, tenantId: string, subject: Subject, opts: { now?: Date; fetcher?: typeof fetch } = {}) {
  const now = opts.now ?? new Date();
  const r = await screenSubject({ name: subject.name, entityType: subject.entityType ?? "person", birthDate: subject.birthDate, nationality: subject.nationality }, { fetcher: opts.fetcher });
  // Ongoing monitoring: re-screen in 90 days after any hit or error, otherwise annually.
  const next = new Date(now.getTime() + (r.status === "clear" ? 365 : r.status === "error" ? 1 : 90) * DAY);
  const [row] = await db
    .insert(s.amlScreenings)
    .values({ tenantId, subjectType: subject.subjectType, subjectId: subject.subjectId ?? null, entityType: subject.entityType ?? "person", name: subject.name, birthDate: subject.birthDate ?? null, nationality: subject.nationality ?? null, jurisdiction: subject.jurisdiction, provider: r.provider, status: r.status, hits: r.hits, riskScore: r.riskScore, error: r.error ?? null, nextReviewAt: next, retainUntil: retain(now), createdAt: now })
    .returning();
  if (r.status === "potential_match" || r.status === "confirmed_match")
    await notify(db, { tenantId, roles: ["tenant_admin"], category: "kyc", title: `Screening ${r.status === "confirmed_match" ? "match" : "potential match"}: ${subject.name}`, body: `${r.hits.length} ${r.hits.length === 1 ? "hit" : "hits"} on ${r.provider}. Review before proceeding.`, href: `/admin/compliance/aml?id=${row!.id}`, priority: "high" }).catch(() => undefined);
  return row!;
}

export async function reviewScreening(db: DB, tenantId: string, id: string, d: { outcome: "false_positive" | "confirmed_match"; note: string; userId: string }) {
  const [before] = await db.select().from(s.amlScreenings).where(scope(s.amlScreenings, tenantId, eq(s.amlScreenings.id, id)));
  if (!before) throw new HttpError(404, "Screening not found.");
  if (before.status === "clear") throw new HttpError(409, "A clear result needs no disposition.");
  const [after] = await db.update(s.amlScreenings).set({ status: d.outcome, decisionNote: d.note, reviewedBy: d.userId, reviewedAt: new Date() }).where(eq(s.amlScreenings.id, id)).returning();
  return { before, after: after! };
}

export async function latestScreening(db: DB, tenantId: string, subjectType: SubjectType, subjectId: string | null, name?: string) {
  const cond = subjectId ? eq(s.amlScreenings.subjectId, subjectId) : eq(sql`lower(${s.amlScreenings.name})`, (name ?? "").toLowerCase());
  const [r] = await db.select().from(s.amlScreenings).where(scope(s.amlScreenings, tenantId, eq(s.amlScreenings.subjectType, subjectType), cond)).orderBy(desc(s.amlScreenings.createdAt)).limit(1);
  return r ?? null;
}

/* -------------------------------------------------------------------- KYC */

export function requiredDocs(j: JurisdictionCode, entityType: "person" | "company", level: "simplified" | "standard" | "enhanced"): KycDoc[] {
  const list = [...JURISDICTIONS[j].cdd[entityType]];
  if (level === "enhanced") list.push(entityType === "person" ? "Source of wealth evidence" : "Source of wealth of beneficial owners");
  if (level === "simplified") list.splice(list.findIndex((x) => /source of funds/i.test(x)), 1);
  return list.map((label) => ({ type: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40), label, documentId: null, status: "missing", expiresAt: null }));
}

export function rateRisk(k: { pepDeclared: boolean; nationality?: string | null; entityType: "person" | "company"; beneficialOwners: { pep: boolean; nationality: string | null }[]; sourceOfFunds: string | null }, screening: { status: string; hits: { topics: string[] }[] } | null, highRisk: string[], cash: boolean) {
  const factors: string[] = [];
  const hr = (n?: string | null) => !!n && highRisk.some((h) => h.toLowerCase() === n.toLowerCase());
  if (k.pepDeclared || k.beneficialOwners.some((b) => b.pep) || screening?.hits.some((h) => h.topics.includes("role.pep"))) factors.push("Politically exposed person");
  if (hr(k.nationality) || k.beneficialOwners.some((b) => hr(b.nationality))) factors.push("Connection with a high-risk jurisdiction");
  if (screening && (screening.status === "potential_match" || screening.status === "confirmed_match")) factors.push("Unresolved or confirmed screening match");
  if (cash) factors.push("Cash or virtual-asset payment");
  if (k.entityType === "company" && !k.beneficialOwners.length) factors.push("Beneficial ownership not declared");
  if (!k.sourceOfFunds) factors.push("Source of funds not declared");
  const high = factors.some((f) => /Politically|high-risk|screening|Cash/.test(f));
  return { rating: high ? ("high" as const) : factors.length ? ("medium" as const) : ("low" as const), factors, level: high ? ("enhanced" as const) : ("standard" as const) };
}

export async function startKyc(db: DB, tenantId: string, s0: { subjectType: SubjectType; subjectId?: string | null; clientId?: string | null; name: string; entityType?: "person" | "company"; jurisdiction: JurisdictionCode; level?: "simplified" | "standard" | "enhanced" }) {
  if (s0.clientId) {
    const [existing] = await db.select().from(s.kycVerifications).where(scope(s.kycVerifications, tenantId, eq(s.kycVerifications.clientId, s0.clientId), inArray(s.kycVerifications.status, ["draft", "submitted", "in_review"])));
    if (existing) return existing;
  }
  const level = s0.level ?? "standard";
  const [row] = await db
    .insert(s.kycVerifications)
    .values({ tenantId, subjectType: s0.subjectType, subjectId: s0.subjectId ?? s0.clientId ?? null, clientId: s0.clientId ?? null, name: s0.name, entityType: s0.entityType ?? "person", jurisdiction: s0.jurisdiction, level, documents: requiredDocs(s0.jurisdiction, s0.entityType ?? "person", level), retainUntil: retain() })
    .returning();
  return row!;
}

async function kycFor(db: DB, tenantId: string, id: string, clientId?: string | null) {
  const [k] = await db.select().from(s.kycVerifications).where(scope(s.kycVerifications, tenantId, eq(s.kycVerifications.id, id), ...(clientId ? [eq(s.kycVerifications.clientId, clientId)] : [])));
  if (!k) throw new HttpError(404, "Verification not found.");
  return k;
}

/** Documents, declarations and beneficial owners; usable by staff or by the client on their own record while it is a draft. */
export async function updateKyc(db: DB, tenantId: string, id: string, patch: { documents?: { type: string; documentId?: string | null; status?: KycDoc["status"]; expiresAt?: string | null; note?: string | null }[]; sourceOfFunds?: string | null; sourceOfWealth?: string | null; pepDeclared?: boolean; beneficialOwners?: s.BeneficialOwner[]; level?: "simplified" | "standard" | "enhanced" }, actor: { clientId?: string | null }) {
  const k = await kycFor(db, tenantId, id, actor.clientId);
  if (actor.clientId && !["draft", "rejected"].includes(k.status)) throw new HttpError(409, "This verification has been submitted; contact your adviser to change it.");
  let docs = k.documents;
  if (patch.level && patch.level !== k.level && !actor.clientId) {
    const need = requiredDocs(k.jurisdiction as JurisdictionCode, k.entityType, patch.level);
    docs = need.map((n) => docs.find((d) => d.type === n.type) ?? n);
  }
  for (const d of patch.documents ?? []) {
    docs = docs.map((x) => (x.type === d.type ? { ...x, documentId: d.documentId ?? x.documentId, status: actor.clientId ? (d.documentId ? "uploaded" : x.status) : (d.status ?? (d.documentId ? "uploaded" : x.status)), expiresAt: d.expiresAt ?? x.expiresAt, note: d.note ?? x.note } : x));
  }
  const [u] = await db
    .update(s.kycVerifications)
    .set({ documents: docs, ...(patch.level && !actor.clientId ? { level: patch.level } : {}), ...(patch.sourceOfFunds !== undefined ? { sourceOfFunds: patch.sourceOfFunds } : {}), ...(patch.sourceOfWealth !== undefined ? { sourceOfWealth: patch.sourceOfWealth } : {}), ...(patch.pepDeclared !== undefined ? { pepDeclared: patch.pepDeclared } : {}), ...(patch.beneficialOwners ? { beneficialOwners: patch.beneficialOwners } : {}) })
    .where(eq(s.kycVerifications.id, k.id))
    .returning();
  return u!;
}

export async function submitKyc(db: DB, tenantId: string, id: string, actor: { clientId?: string | null }) {
  const k = await kycFor(db, tenantId, id, actor.clientId);
  const missing = k.documents.filter((d) => d.status === "missing");
  if (missing.length) throw new HttpError(422, `Upload ${missing.map((d) => d.label.toLowerCase()).join(", ")} before submitting.`);
  if (!k.sourceOfFunds) throw new HttpError(422, "Describe the source of funds before submitting.");
  const [u] = await db.update(s.kycVerifications).set({ status: "submitted", submittedAt: new Date() }).where(eq(s.kycVerifications.id, k.id)).returning();
  await notify(db, { tenantId, roles: ["tenant_admin"], category: "kyc", title: `KYC submitted: ${k.name}`, body: "Documents and declarations are ready for review.", href: `/admin/compliance/kyc?id=${k.id}` }).catch(() => undefined);
  return u!;
}

/**
 * The decision. Approval needs every document verified, a screening that is
 * clear or dispositioned as a false positive within the last twelve months,
 * and, at enhanced level, the source of wealth. Review falls due after one,
 * two or three years by risk, or at the earliest document expiry.
 */
export async function decideKyc(db: DB, tenantId: string, id: string, d: { decision: "approved" | "rejected"; note: string; userId: string; now?: Date }) {
  const k = await kycFor(db, tenantId, id);
  const now = d.now ?? new Date();
  const settings = await complianceSettings(db, tenantId);
  const sc = await latestScreening(db, tenantId, k.subjectType, k.subjectId, k.name);
  const risk = rateRisk({ pepDeclared: k.pepDeclared, entityType: k.entityType, beneficialOwners: k.beneficialOwners, sourceOfFunds: k.sourceOfFunds }, sc, settings.highRiskCountries, false);
  if (d.decision === "approved") {
    const unverified = k.documents.filter((x) => x.status !== "verified");
    if (unverified.length) throw new HttpError(422, `Verify ${unverified.map((x) => x.label.toLowerCase()).join(", ")} first.`);
    if (!sc || now.getTime() - sc.createdAt.getTime() > 365 * DAY) throw new HttpError(422, "Screen the subject before approving.");
    if (sc.status === "potential_match" || sc.status === "error") throw new HttpError(422, "Disposition the screening result before approving.");
    if (sc.status === "confirmed_match") throw new HttpError(422, "The subject is a confirmed screening match. Do not proceed; consider a suspicious transaction report.");
    if ((k.level === "enhanced" || risk.rating === "high") && !k.sourceOfWealth) throw new HttpError(422, "Enhanced due diligence requires the source of wealth.");
  }
  const years = risk.rating === "high" ? 1 : risk.rating === "medium" ? 2 : 3;
  const docExpiry = k.documents.map((x) => x.expiresAt).filter((x): x is string => !!x).sort()[0];
  const review = new Date(now.getTime() + years * 365 * DAY);
  const expiresAt = docExpiry && new Date(docExpiry) < review ? new Date(docExpiry) : review;
  const [u] = await db
    .update(s.kycVerifications)
    .set({ status: d.decision, decidedBy: d.userId, decidedAt: now, decisionNote: d.note, riskRating: risk.rating, riskFactors: risk.factors, level: risk.level === "enhanced" ? "enhanced" : k.level, expiresAt: d.decision === "approved" ? expiresAt : null, retainUntil: retain(now) })
    .where(eq(s.kycVerifications.id, k.id))
    .returning();
  if (k.clientId) await db.update(s.clients).set({ kycStatus: d.decision === "approved" ? "verified" : "rejected" }).where(eq(s.clients.id, k.clientId));
  return u!;
}

/* ------------------------------------------------------------ deal checks */

const CHECK_TITLES: Record<string, string> = {
  cdd_client: "Customer due diligence on our client",
  screen_client: "Sanctions and PEP screening of our client",
  screen_counterparty: "Sanctions screening of the counterparty",
  edd: "Enhanced due diligence where required",
  cash: "Cash and virtual-asset payments",
  open_reports: "Regulatory reports outstanding",
};

export async function evaluateDeal(db: DB, tenantId: string, dealId: string, opts: { now?: Date; screenCounterparty?: boolean } = {}) {
  const now = opts.now ?? new Date();
  const [deal] = await db.select({ d: s.deals, client: s.clients }).from(s.deals).innerJoin(s.clients, eq(s.clients.id, s.deals.clientId)).where(scope(s.deals, tenantId, eq(s.deals.id, dealId)));
  if (!deal) throw new HttpError(404, "Deal not found.");
  const settings = await complianceSettings(db, tenantId);
  const code: JurisdictionCode = deal.d.jurisdiction === "mumbai" || deal.d.jurisdiction === "goa" ? "IN" : deal.d.jurisdiction === "dubai" || deal.d.jurisdiction === "abu_dhabi" ? "AE" : (settings.jurisdictions[0] ?? "AE");
  const j = JURISDICTIONS[code];
  const out: { rule: string; status: "pass" | "action_required" | "fail"; detail: string; basis: "statutory" | "firm_policy" }[] = [];

  const [kyc] = await db.select().from(s.kycVerifications).where(scope(s.kycVerifications, tenantId, eq(s.kycVerifications.clientId, deal.client.id))).orderBy(desc(s.kycVerifications.createdAt)).limit(1);
  const [legacy] = await db.select().from(s.kycRecords).where(scope(s.kycRecords, tenantId, eq(s.kycRecords.clientId, deal.client.id)));
  const kycOk = (kyc?.status === "approved" && (!kyc.expiresAt || kyc.expiresAt > now)) || (legacy?.status === "verified" && (!legacy.expiresAt || legacy.expiresAt > now));
  out.push({ rule: "cdd_client", status: kycOk ? "pass" : "action_required", detail: kycOk ? `Verified${kyc?.expiresAt ? `; review due ${kyc.expiresAt.toISOString().slice(0, 10)}` : ""}.` : kyc ? `Verification is ${kyc.status.replace("_", " ")}.` : "No verification on file. Start KYC from the compliance centre or the client's portal.", basis: "statutory" });

  const sc = await latestScreening(db, tenantId, "client", deal.client.id, deal.client.name);
  const fresh = sc && now.getTime() - sc.createdAt.getTime() <= 365 * DAY;
  out.push({ rule: "screen_client", status: !fresh ? "action_required" : sc.status === "confirmed_match" ? "fail" : sc.status === "clear" || sc.status === "false_positive" ? "pass" : "action_required", detail: !sc ? "Not screened." : !fresh ? "Last screened more than twelve months ago." : sc.status === "clear" ? `Clear on ${sc.provider}.` : sc.status === "false_positive" ? "Potential match dispositioned as a false positive." : sc.status === "confirmed_match" ? "Confirmed match. Do not proceed; consider a suspicious transaction report." : "Potential match awaiting disposition.", basis: "statutory" });

  let cp = await latestScreening(db, tenantId, "counterparty", null, deal.d.counterparty);
  if ((!cp || now.getTime() - cp.createdAt.getTime() > 365 * DAY) && opts.screenCounterparty !== false) cp = await screen(db, tenantId, { subjectType: "counterparty", subjectId: null, name: deal.d.counterparty, jurisdiction: code }, { now });
  out.push({ rule: "screen_counterparty", status: !cp ? "action_required" : cp.status === "confirmed_match" ? "fail" : cp.status === "clear" || cp.status === "false_positive" ? "pass" : "action_required", detail: !cp ? "Not screened." : cp.status === "clear" ? `${deal.d.counterparty}: clear on ${cp.provider}.` : `${deal.d.counterparty}: ${cp.status.replace("_", " ")}.`, basis: "firm_policy" });

  const payments = await db.select().from(s.paymentsSchedule).where(scope(s.paymentsSchedule, tenantId, eq(s.paymentsSchedule.dealId, dealId)));
  const cashSum = payments.reduce((a, p) => a + (p.method === "cash" ? (p.cashAmount ?? p.amount) : p.method === "mixed" ? (p.cashAmount ?? 0) : 0), 0);
  const virtual = payments.some((p) => p.method === "virtual_asset");
  const risk = rateRisk({ pepDeclared: kyc?.pepDeclared ?? legacy?.pep ?? false, nationality: deal.client.nationality, entityType: kyc?.entityType ?? "person", beneficialOwners: kyc?.beneficialOwners ?? [], sourceOfFunds: kyc?.sourceOfFunds ?? legacy?.sourceOfFunds ?? null }, sc, settings.highRiskCountries, cashSum > 0 || virtual);
  const eddNeeded = risk.rating === "high";
  const eddDone = kyc?.level === "enhanced" && kyc.status === "approved";
  out.push({ rule: "edd", status: !eddNeeded || eddDone ? "pass" : "action_required", detail: eddNeeded ? `${risk.factors.join("; ")}. ${eddDone ? "Enhanced due diligence approved." : "Enhanced due diligence and senior management approval are required."}` : "No enhanced due diligence trigger.", basis: "statutory" });

  const t = j.cashThreshold;
  const reports = await db.select().from(s.regulatoryReports).where(scope(s.regulatoryReports, tenantId, eq(s.regulatoryReports.dealId, dealId)));
  const filed = (type: ReportType) => reports.some((r) => r.type === type && r.status === "filed");
  const cashInThresholdCurrency = t && t.currency === deal.d.currency ? cashSum : null;
  const over = !!t && ((cashInThresholdCurrency !== null && cashInThresholdCurrency >= t.amount) || (code === "AE" && virtual));
  if (code === "AE") out.push({ rule: "cash", status: !over ? "pass" : filed("rear") ? "pass" : "action_required", detail: !over ? (cashSum ? `Cash of AED ${cashSum.toLocaleString("en-US")} is below the AED 55,000 REAR threshold.` : "No cash or virtual-asset payments recorded.") : filed("rear") ? "REAR filed." : `${virtual ? "Virtual-asset payment" : `Cash of AED ${cashSum.toLocaleString("en-US")}`}: a Real Estate Activity Report is required through goAML.`, basis: "statutory" });
  else if (code === "IN") out.push({ rule: "cash", status: !over ? "pass" : "action_required", detail: over ? `Cash of ₹${cashSum.toLocaleString("en-IN")} exceeds ₹10 lakh: include it in this month's Cash Transaction Report. Note that the Income-tax Act prohibits receiving ₹2 lakh or more in cash for a single transaction (section 269ST).` : "No reportable cash.", basis: "statutory" });
  else out.push({ rule: "cash", status: !cashSum && !virtual ? "pass" : "action_required", detail: cashSum || virtual ? `${t?.rule ?? "Cash payments are escalated for enhanced checks."}` : "No cash or virtual-asset payments recorded.", basis: t?.basis ?? "firm_policy" });

  const open = reports.filter((r) => r.status === "draft" || r.status === "ready");
  out.push({ rule: "open_reports", status: open.length ? "action_required" : "pass", detail: open.length ? `${open.map((r) => r.title).join(", ")} not yet filed.` : "None outstanding.", basis: "statutory" });

  // Upsert, keeping waivers the MLRO has recorded.
  const existing = await db.select().from(s.complianceChecks).where(scope(s.complianceChecks, tenantId, eq(s.complianceChecks.dealId, dealId)));
  for (const c of out) {
    const prev = existing.find((e) => e.rule === c.rule);
    const status = prev?.status === "waived" && c.status !== "pass" ? "waived" : c.status;
    if (prev) await db.update(s.complianceChecks).set({ status, detail: c.detail, basis: c.basis, jurisdiction: code, title: CHECK_TITLES[c.rule]!, evaluatedAt: now }).where(eq(s.complianceChecks.id, prev.id));
    else await db.insert(s.complianceChecks).values({ tenantId, dealId, jurisdiction: code, rule: c.rule, title: CHECK_TITLES[c.rule]!, status, detail: c.detail, basis: c.basis, evaluatedAt: now });
  }
  return { jurisdiction: code, checks: await db.select().from(s.complianceChecks).where(scope(s.complianceChecks, tenantId, eq(s.complianceChecks.dealId, dealId))), risk };
}

export async function waiveCheck(db: DB, tenantId: string, id: string, d: { reason: string; userId: string }) {
  const [c] = await db.select().from(s.complianceChecks).where(scope(s.complianceChecks, tenantId, eq(s.complianceChecks.id, id)));
  if (!c) throw new HttpError(404, "Check not found.");
  if (c.basis === "statutory" && c.status === "fail") throw new HttpError(409, "A failed statutory check cannot be waived.");
  const [u] = await db.update(s.complianceChecks).set({ status: "waived", waivedBy: d.userId, waiverReason: d.reason }).where(eq(s.complianceChecks.id, id)).returning();
  return u!;
}

export async function recordPaymentMethod(db: DB, tenantId: string, paymentId: string, d: { method: "bank_transfer" | "cheque" | "cash" | "virtual_asset" | "mixed"; cashAmount?: number | null }) {
  const [u] = await db
    .update(s.paymentsSchedule)
    .set({ method: d.method, cashAmount: d.method === "cash" || d.method === "mixed" ? (d.cashAmount ?? null) : null })
    .where(scope(s.paymentsSchedule, tenantId, eq(s.paymentsSchedule.id, paymentId)))
    .returning();
  if (!u) throw new HttpError(404, "Payment not found.");
  return u;
}

/* ---------------------------------------------------------------- reports */

const nextFifteenth = (period: string) => {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 15, 23, 59));
};

export async function prepareReport(db: DB, tenantId: string, user: { id: string; name: string }, b: { jurisdiction: JurisdictionCode; type: ReportType; dealId?: string | null; period?: string | null; reason?: string | null; indicators?: string[]; action?: string | null; now?: Date }) {
  const now = b.now ?? new Date();
  const j = JURISDICTIONS[b.jurisdiction];
  const spec = j.reports.find((r) => r.type === b.type);
  if (!spec) throw new HttpError(422, `${j.name} has no ${b.type.toUpperCase()} report.`);
  if ((b.type === "str" || b.type === "sar") && !b.reason?.trim()) throw new HttpError(422, "State the grounds for suspicion.");
  const settings = await complianceSettings(db, tenantId);
  const transactions: ReportTransaction[] = [];
  let subjectName: string | null = null;
  if (b.dealId) {
    const [row] = await db.select({ d: s.deals, client: s.clients, property: s.properties.name }).from(s.deals).innerJoin(s.clients, eq(s.clients.id, s.deals.clientId)).innerJoin(s.properties, eq(s.properties.id, s.deals.propertyId)).where(scope(s.deals, tenantId, eq(s.deals.id, b.dealId)));
    if (!row) throw new HttpError(404, "Deal not found.");
    const pays = await db.select().from(s.paymentsSchedule).where(scope(s.paymentsSchedule, tenantId, eq(s.paymentsSchedule.dealId, b.dealId)));
    const cash = pays.reduce((a, p) => a + (p.method === "cash" ? (p.cashAmount ?? p.amount) : p.method === "mixed" ? (p.cashAmount ?? 0) : 0), 0);
    const modes = new Set(pays.map((p) => p.method).filter(Boolean));
    const ours: ReportParty = { name: row.client.name, entityType: /family office|company|llc|ltd/i.test(row.client.type) ? "company" : "person", nationality: row.client.nationality, role: row.d.side === "buy" ? "buyer" : "seller" };
    const theirs: ReportParty = { name: row.d.counterparty, entityType: /llc|ltd|limited|fze|fzco|plc|pvt|inc/i.test(row.d.counterparty) ? "company" : "person", role: row.d.side === "buy" ? "seller" : "buyer" };
    transactions.push({ reference: row.d.reference, date: (row.d.actualCloseDate ?? row.d.targetCloseDate ?? now.toISOString().slice(0, 10)).toString().slice(0, 10), amount: row.d.value, currency: row.d.currency, mode: modes.size > 1 ? "mixed" : ((([...modes][0] as ReportTransaction["mode"] | undefined) ?? "bank_transfer")), cashAmount: cash || undefined, property: row.property, parties: [ours, theirs] });
    subjectName = row.d.side === "buy" ? row.client.name : row.d.counterparty;
  }
  let register: ReportInput["register"];
  if (b.type === "kyc_register") {
    const ks = await db.select().from(s.kycVerifications).where(scope(s.kycVerifications, tenantId, eq(s.kycVerifications.jurisdiction, b.jurisdiction))).orderBy(s.kycVerifications.name);
    register = await Promise.all(
      ks.map(async (k) => {
        const sc = await latestScreening(db, tenantId, k.subjectType, k.subjectId, k.name);
        return { name: k.name, entityType: k.entityType, level: k.level, risk: k.riskRating, status: k.status, verifiedAt: k.decidedAt?.toISOString().slice(0, 10) ?? null, expiresAt: k.expiresAt?.toISOString().slice(0, 10) ?? null, pep: k.pepDeclared, sourceOfFunds: k.sourceOfFunds, screening: sc ? `${sc.status.replace("_", " ")} (${sc.createdAt.toISOString().slice(0, 10)})` : "Not screened" };
      }),
    );
  }
  if (b.type === "ctr") {
    if (!b.period || !/^\d{4}-\d{2}$/.test(b.period)) throw new HttpError(422, "Choose the month the report covers.");
    const [y, m] = b.period.split("-").map(Number) as [number, number];
    const from = `${b.period}-01`;
    const to = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const rows = await db
      .select({ p: s.paymentsSchedule, d: s.deals, client: s.clients, property: s.properties.name })
      .from(s.paymentsSchedule)
      .innerJoin(s.deals, eq(s.deals.id, s.paymentsSchedule.dealId))
      .innerJoin(s.clients, eq(s.clients.id, s.deals.clientId))
      .innerJoin(s.properties, eq(s.properties.id, s.deals.propertyId))
      .where(and(scope(s.paymentsSchedule, tenantId, isNotNull(s.paymentsSchedule.method), inArray(s.paymentsSchedule.method, ["cash", "mixed"])), sql`coalesce(${s.paymentsSchedule.paidAt}::date, ${s.paymentsSchedule.dueDate}) >= ${from}::date`, sql`coalesce(${s.paymentsSchedule.paidAt}::date, ${s.paymentsSchedule.dueDate}) < ${to}::date`));
    // Integrally connected: sum per deal within the month.
    const byDeal = new Map<string, typeof rows>();
    for (const r of rows) byDeal.set(r.d.id, [...(byDeal.get(r.d.id) ?? []), r]);
    for (const [, rs] of byDeal) {
      const cash = rs.reduce((a, r) => a + (r.p.method === "cash" ? (r.p.cashAmount ?? r.p.amount) : (r.p.cashAmount ?? 0)), 0);
      if (cash <= 1_000_000 || rs[0]!.p.currency !== "INR") continue;
      const r0 = rs[0]!;
      transactions.push({ reference: r0.d.reference, date: (r0.p.paidAt?.toISOString() ?? String(r0.p.dueDate)).slice(0, 10), amount: rs.reduce((a, r) => a + r.p.amount, 0), currency: "INR", mode: "cash", cashAmount: cash, property: r0.property, parties: [{ name: r0.client.name, entityType: "person", nationality: r0.client.nationality, role: "payer" }] });
    }
  }
  const reference = `${b.type.toUpperCase()}-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const input: ReportInput = { jurisdiction: b.jurisdiction, type: b.type, firm: { name: settings.firm, entityId: settings.goamlEntityId, mlroName: settings.mlroName ?? user.name, mlroEmail: settings.mlroEmail }, submittedAt: now, reference, reason: b.reason ?? undefined, indicators: b.indicators, action: b.action ?? undefined, transactions, register, period: b.period ?? undefined };
  const built = buildReport(input);
  const dueAt = b.type === "ctr" && b.period ? nextFifteenth(b.period) : spec.deadlineDays ? new Date(now.getTime() + spec.deadlineDays * DAY) : null;
  const title = `${spec.name}${subjectName ? `: ${subjectName}` : b.period ? `, ${b.period}` : ""}`;
  const [row] = await db
    .insert(s.regulatoryReports)
    .values({ tenantId, jurisdiction: b.jurisdiction, type: b.type, title, period: b.period ?? null, dealId: b.dealId ?? null, subjectName, status: b.type === "kyc_register" ? "ready" : "draft", format: built.format, content: built.content, narrative: b.reason ?? null, data: { reference, transactions: transactions.length, filename: built.filename, mime: built.mime }, dueAt, preparedBy: user.id, retainUntil: retain(now) })
    .returning();
  return row!;
}

export async function setReportStatus(db: DB, tenantId: string, id: string, d: { status: "ready" | "filed" | "withdrawn"; reference?: string | null; userId: string }) {
  const [r] = await db.select().from(s.regulatoryReports).where(scope(s.regulatoryReports, tenantId, eq(s.regulatoryReports.id, id)));
  if (!r) throw new HttpError(404, "Report not found.");
  if (r.status === "filed") throw new HttpError(409, "A filed report cannot be changed; record any follow-up as a new report.");
  if (d.status === "filed" && !d.reference?.trim() && r.type !== "kyc_register") throw new HttpError(422, "Record the filing reference issued by the FIU.");
  const [u] = await db.update(s.regulatoryReports).set({ status: d.status, ...(d.status === "filed" ? { filedAt: new Date(), filedBy: d.userId, filingReference: d.reference ?? null } : {}) }).where(eq(s.regulatoryReports.id, id)).returning();
  return u!;
}

/* --------------------------------------------------------- monitoring job */

/**
 * Daily: re-screens subjects whose review date has passed, expires lapsed
 * verifications, and deletes records whose seven-year retention has ended
 * (never a report that is not filed or withdrawn).
 */
export async function runMonitoring(db: DB, opts: { now?: Date; tenantIds?: string[]; fetcher?: typeof fetch } = {}) {
  const now = opts.now ?? new Date();
  const due = await db.select().from(s.amlScreenings).where(and(lte(s.amlScreenings.nextReviewAt, now), opts.tenantIds?.length ? inArray(s.amlScreenings.tenantId, opts.tenantIds) : sql`true`)).orderBy(desc(s.amlScreenings.createdAt)).limit(200);
  const seen = new Set<string>();
  let rescreened = 0;
  for (const r of due) {
    const key = `${r.tenantId}:${r.subjectType}:${r.subjectId ?? r.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await db.update(s.amlScreenings).set({ nextReviewAt: null }).where(eq(s.amlScreenings.id, r.id));
    await screen(db, r.tenantId, { subjectType: r.subjectType, subjectId: r.subjectId, name: r.name, entityType: r.entityType, birthDate: r.birthDate, nationality: r.nationality, jurisdiction: r.jurisdiction as JurisdictionCode }, { now, fetcher: opts.fetcher });
    rescreened++;
  }
  const expired = await db
    .update(s.kycVerifications)
    .set({ status: "expired" })
    .where(and(eq(s.kycVerifications.status, "approved"), lte(s.kycVerifications.expiresAt, now), opts.tenantIds?.length ? inArray(s.kycVerifications.tenantId, opts.tenantIds) : sql`true`))
    .returning({ id: s.kycVerifications.id, clientId: s.kycVerifications.clientId, tenantId: s.kycVerifications.tenantId });
  for (const e of expired) if (e.clientId) await db.update(s.clients).set({ kycStatus: "expired" }).where(eq(s.clients.id, e.clientId));
  const tenantCond = (col: typeof s.amlScreenings.tenantId) => (opts.tenantIds?.length ? inArray(col, opts.tenantIds) : sql`true`);
  const purgedScreenings = await db.delete(s.amlScreenings).where(and(lte(s.amlScreenings.retainUntil, now), tenantCond(s.amlScreenings.tenantId))).returning({ id: s.amlScreenings.id });
  const purgedKyc = await db.delete(s.kycVerifications).where(and(lte(s.kycVerifications.retainUntil, now), ne(s.kycVerifications.status, "in_review"), opts.tenantIds?.length ? inArray(s.kycVerifications.tenantId, opts.tenantIds) : sql`true`)).returning({ id: s.kycVerifications.id });
  const purgedReports = await db.delete(s.regulatoryReports).where(and(lte(s.regulatoryReports.retainUntil, now), inArray(s.regulatoryReports.status, ["filed", "withdrawn"]), opts.tenantIds?.length ? inArray(s.regulatoryReports.tenantId, opts.tenantIds) : sql`true`)).returning({ id: s.regulatoryReports.id });
  const overdue = await db.select({ id: s.regulatoryReports.id, tenantId: s.regulatoryReports.tenantId, title: s.regulatoryReports.title }).from(s.regulatoryReports).where(and(inArray(s.regulatoryReports.status, ["draft", "ready"]), lte(s.regulatoryReports.dueAt, now), opts.tenantIds?.length ? inArray(s.regulatoryReports.tenantId, opts.tenantIds) : sql`true`));
  for (const o of overdue) await notify(db, { tenantId: o.tenantId, roles: ["tenant_admin"], category: "kyc", title: `Report past its deadline: ${o.title}`, body: "File it with the FIU and record the reference, or withdraw it with a note.", href: "/admin/compliance/reports", priority: "high" }).catch(() => undefined);
  return { rescreened, expired: expired.length, purged: { screenings: purgedScreenings.length, kyc: purgedKyc.length, reports: purgedReports.length }, overdue: overdue.length };
}

export async function overview(db: DB, tenantId: string) {
  const [screens, kyc, checks, reports] = await Promise.all([
    db.select({ status: s.amlScreenings.status, n: sql<number>`count(*)::int` }).from(s.amlScreenings).where(scope(s.amlScreenings, tenantId)).groupBy(s.amlScreenings.status),
    db.select({ status: s.kycVerifications.status, risk: s.kycVerifications.riskRating, n: sql<number>`count(*)::int` }).from(s.kycVerifications).where(scope(s.kycVerifications, tenantId)).groupBy(s.kycVerifications.status, s.kycVerifications.riskRating),
    db.select({ status: s.complianceChecks.status, n: sql<number>`count(*)::int` }).from(s.complianceChecks).where(scope(s.complianceChecks, tenantId)).groupBy(s.complianceChecks.status),
    db.select().from(s.regulatoryReports).where(scope(s.regulatoryReports, tenantId)).orderBy(desc(s.regulatoryReports.createdAt)).limit(50),
  ]);
  const count = <T extends { n: number }>(rows: T[], f: (r: T) => boolean) => rows.filter(f).reduce((a, r) => a + r.n, 0);
  return {
    screenings: { total: count(screens, () => true), open: count(screens, (r) => r.status === "potential_match" || r.status === "error"), confirmed: count(screens, (r) => r.status === "confirmed_match") },
    kyc: { approved: count(kyc, (r) => r.status === "approved"), pending: count(kyc, (r) => r.status === "submitted" || r.status === "in_review"), draft: count(kyc, (r) => r.status === "draft"), high: count(kyc, (r) => r.risk === "high" && r.status !== "rejected"), expired: count(kyc, (r) => r.status === "expired") },
    checks: { open: count(checks, (r) => r.status === "action_required" || r.status === "fail") },
    reports: { open: reports.filter((r) => r.status === "draft" || r.status === "ready").length, overdue: reports.filter((r) => (r.status === "draft" || r.status === "ready") && r.dueAt && r.dueAt < new Date()).length, recent: reports.slice(0, 8) },
  };
}
