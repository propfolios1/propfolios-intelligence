import { desc } from "drizzle-orm";
import { PlanPicker } from "@/components/admin/plan-picker";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { PageContainer } from "@/components/shell/page-container";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole, seatUsage } from "@/lib/auth";
import { planById, VAT_RATE } from "@/lib/plans";
import { getTenantById } from "@/lib/tenant";
import { scope } from "@/lib/tenant-db";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

const aed = (n: number) => `AED ${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function BillingPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const tenant = (await getTenantById(user.tenantId))!;
  const seats = await seatUsage(user.tenantId);
  const subs = await db.select().from(s.subscriptions).where(scope(s.subscriptions, user.tenantId)).orderBy(desc(s.subscriptions.startedAt));
  const sub = subs[0];
  // Monthly invoices from the first paid month to date. Trials are not invoiced.
  const invoices: { number: string; period: string; amount: number; vat: number; due: Date; status: "Paid" | "Due" }[] = [];
  if (sub && sub.status !== "trialing") {
    const start = new Date(sub.startedAt);
    const now = new Date();
    for (let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1)); d <= now; d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))) {
      if (sub.cancelledAt && d > sub.cancelledAt) break;
      const ym = d.toISOString().slice(0, 7);
      const current = ym === now.toISOString().slice(0, 7);
      invoices.unshift({ number: `NKH-${tenant.slug.toUpperCase().slice(0, 6)}-${ym.replace("-", "")}`, period: d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }), amount: sub.priceAed, vat: sub.priceAed * VAT_RATE, due: new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15)), status: current ? "Due" : "Paid" });
    }
  }
  const trialDays = sub?.status === "trialing" ? Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86_400_000)) : null;
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Billing" subtitle={`Invoiced monthly in AED by bank transfer. VAT at ${VAT_RATE * 100}% applies. Questions: billing@nakhla.ai.`} />
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Plan" value={seats.plan.name} note={`AED ${seats.plan.priceAed.toLocaleString("en-US")} a month`} />
        <StatCard label="Status" value={trialDays !== null ? `Trial, ${trialDays} days left` : sub?.status === "active" ? "Active" : (sub?.status ?? "None")} note={sub ? `Current period ends ${formatDate(sub.currentPeriodEnd)}` : undefined} />
        <StatCard label="Staff seats" value={`${seats.used} / ${seats.limit ?? "∞"}`} note="Clients do not use seats" />
      </section>
      <section className="mt-10">
        <h2 className="mb-4 font-display text-card text-navy-900">Change plan</h2>
        <PlanPicker current={tenant.plan} seatsUsed={seats.used} />
      </section>
      <section className="mt-10">
        <h2 className="mb-4 font-display text-card text-navy-900">Invoices</h2>
        {invoices.length === 0 ? (
          <p className="rounded-md border border-ink-200 bg-surface p-6 text-ui text-ink-700 shadow-card">No invoices yet. Your first invoice is issued when the trial converts to {planById(tenant.plan).name}.</p>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Invoice</TH>
                <TH>Period</TH>
                <TH numeric>Amount</TH>
                <TH numeric>VAT</TH>
                <TH numeric>Total</TH>
                <TH>Due</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <tbody>
              {invoices.map((i) => (
                <TR key={i.number}>
                  <TD className="num text-small">{i.number}</TD>
                  <TD>{i.period}</TD>
                  <TD numeric>{aed(i.amount)}</TD>
                  <TD numeric>{aed(i.vat)}</TD>
                  <TD numeric className="font-medium">{aed(i.amount + i.vat)}</TD>
                  <TD className="num text-small">{formatDate(i.due)}</TD>
                  <TD>
                    <StatusPill tone={i.status === "Paid" ? "complete" : "progress"}>{i.status}</StatusPill>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </section>
    </PageContainer>
  );
}
