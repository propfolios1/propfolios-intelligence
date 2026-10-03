import "server-only";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { runClientSuccess, runReportWriter, runStatementGenerator } from "@/lib/client/agents";
import { computeWalletShare, generateTaxDocuments, previousMonth } from "@/lib/client/servicing";
import { markOverdue } from "@/lib/commission/service";
import { factsFor, runAutomations } from "./automations";
import { notify } from "./notify";

export type ScheduledJob = "statements" | "reports" | "tax_documents" | "kyc" | "invoices" | "wallet";

/** Which periodic jobs fall due on a date: statements on the 1st, quarterly reports and wallet share on the 1st of each quarter, tax documents on 1 April; KYC and invoice checks daily. */
export function jobsDue(d: Date): ScheduledJob[] {
  const jobs: ScheduledJob[] = ["kyc", "invoices"];
  if (d.getUTCDate() === 1) jobs.push("statements");
  if (d.getUTCDate() === 1 && d.getUTCMonth() % 3 === 0) jobs.push("reports", "wallet");
  if (d.getUTCDate() === 1 && d.getUTCMonth() === 3) jobs.push("tax_documents");
  return jobs;
}

/**
 * The daily client-servicing run for one tenant: overdue invoices, KYC expiry
 * reminders (30, 14, 7 and 1 days out) and the kyc.expired automation
 * trigger, and on their dates the monthly statements, quarterly reports,
 * wallet share and annual tax documents, each written by its agent.
 */
export async function runDailyForTenant(db: DB, tenantId: string, at = new Date(), force: ScheduledJob[] = []) {
  const jobs = [...new Set([...jobsDue(at), ...force])];
  const actor = { tenantId, name: "Scheduler" };
  const out: Record<string, number> = {};
  const clients = await db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(eq(s.clients.tenantId, tenantId));
  if (jobs.includes("invoices")) out.overdueInvoices = await markOverdue(db, tenantId);
  if (jobs.includes("kyc")) {
    const now = at.getTime();
    const soon = await db.select({ k: s.kycRecords, name: s.clients.name }).from(s.kycRecords).innerJoin(s.clients, eq(s.clients.id, s.kycRecords.clientId)).where(and(eq(s.kycRecords.tenantId, tenantId), eq(s.kycRecords.status, "verified"), gte(s.kycRecords.expiresAt, new Date(now - 86_400_000)), lte(s.kycRecords.expiresAt, new Date(now + 31 * 86_400_000))));
    let reminders = 0;
    for (const r of soon) {
      const days = Math.ceil((r.k.expiresAt!.getTime() - now) / 86_400_000);
      if (![30, 14, 7, 1].includes(days)) continue;
      await notify(db, { tenantId, roles: ["tenant_admin"], category: "kyc", priority: days <= 7 ? "high" : "normal", title: `KYC for ${r.name} expires in ${days} day${days === 1 ? "" : "s"}`, body: "Request updated documents through the client portal; transactions are blocked once KYC lapses.", href: `/admin/kyc/${r.k.clientId}` });
      reminders++;
    }
    const lapsed = await db.update(s.kycRecords).set({ status: "expired" }).where(and(eq(s.kycRecords.tenantId, tenantId), eq(s.kycRecords.status, "verified"), lte(s.kycRecords.expiresAt, at))).returning({ clientId: s.kycRecords.clientId });
    if (lapsed.length) await db.update(s.clients).set({ kycStatus: "expired" }).where(and(eq(s.clients.tenantId, tenantId), inArray(s.clients.id, lapsed.map((l) => l.clientId))));
    for (const l of lapsed) await runAutomations(db, tenantId, "kyc.expired", await factsFor(db, tenantId, { clientId: l.clientId, label: "KYC expired", href: `/admin/kyc/${l.clientId}` }));
    out.kycReminders = reminders;
    out.kycExpired = lapsed.length;
  }
  out.budgetAlerts = await checkAiBudget(db, tenantId, at);
  if (jobs.includes("statements")) {
    const period = previousMonth(at);
    for (const c of clients) await runStatementGenerator(db, actor, c.id, period);
    out.statements = clients.length;
  }
  if (jobs.includes("reports")) {
    for (const c of clients) await runReportWriter(db, actor, c.id, "quarterly");
    out.reports = clients.length;
  }
  if (jobs.includes("wallet")) {
    const q = `${at.getUTCFullYear()}-Q${Math.floor(at.getUTCMonth() / 3) + 1}`;
    for (const c of clients) {
      await computeWalletShare(db, tenantId, c.id, q);
      await runClientSuccess(db, actor, c.id);
    }
    out.wallet = clients.length;
  }
  if (jobs.includes("tax_documents")) {
    for (const c of clients) await generateTaxDocuments(db, tenantId, c.id, at.getUTCFullYear() - 1);
    out.taxDocuments = clients.length;
  }
  return { jobs, ...out };
}

/** Notifies administrators once per month when AI spend crosses 80% and then 100% of the budget set in AI control. */
async function checkAiBudget(db: DB, tenantId: string, at: Date) {
  const [t] = await db.select({ cfg: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.id, tenantId));
  const budget = t?.cfg.ai?.monthlyBudgetUsd;
  if (!budget) return 0;
  const monthStart = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1));
  const [m] = await db.select({ usd: sql<number>`coalesce(sum(${s.auditLogs.costUsd}), 0)::float8` }).from(s.auditLogs).where(and(eq(s.auditLogs.tenantId, tenantId), eq(s.auditLogs.actorType, "agent"), gte(s.auditLogs.createdAt, monthStart), lte(s.auditLogs.createdAt, at)));
  const share = (m?.usd ?? 0) / budget;
  const level = share >= 1 ? 100 : share >= 0.8 ? 80 : 0;
  if (!level) return 0;
  const title = `AI spend has reached ${level}% of the monthly budget`;
  const [sent] = await db.select({ id: s.notifications.id }).from(s.notifications).where(and(eq(s.notifications.tenantId, tenantId), eq(s.notifications.title, title), gte(s.notifications.createdAt, monthStart))).limit(1);
  if (sent) return 0;
  return notify(db, { tenantId, roles: ["tenant_admin"], category: "system", priority: level === 100 ? "high" : "normal", title, body: `$${(m?.usd ?? 0).toFixed(2)} of $${budget.toLocaleString("en-US")} used this month. Agents keep running; review usage or switch agents off in AI control.`, href: "/admin/ai-control" });
}

export async function runDailyAllTenants(db: DB, at = new Date(), force: ScheduledJob[] = []) {
  const tenants = await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants).where(inArray(s.tenants.status, ["active", "trial"]));
  const results = [];
  for (const t of tenants) if (!t.cfg.platform) results.push({ tenantId: t.id, ...(await runDailyForTenant(db, t.id, at, force)) });
  return results;
}
