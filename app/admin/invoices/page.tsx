import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { ReconcilePanel, TaxReportPanel } from "@/components/commission/invoice-actions";
import { Flag } from "@/components/os/badges";
import { activeTab, SectionTabs } from "@/components/os/section-tabs";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { toAed } from "@/lib/commission/engine";
import { listInvoices } from "@/lib/commission/service";
import { formatLocal } from "@/lib/format";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

const TABS = [
  ["invoices", "Invoices"],
  ["reconcile", "Reconciliation"],
  ["tax", "Tax returns"],
] as const;
const INVOICE_TONE = { draft: "neutral", issued: "progress", partially_paid: "progress", paid: "complete", overdue: "error", void: "neutral" } as const;

export default async function AdminInvoices({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const tab = activeTab(TABS, (await searchParams).tab);
  const rows = await listInvoices(await getDb(), user.tenantId);
  const open = rows.filter((r) => ["issued", "partially_paid", "overdue"].includes(r.invoice.status));
  const outstanding = open.reduce((a, r) => a + toAed(r.invoice.total - (r.invoice.tax.tdsAmount ?? 0), r.invoice.currency), 0);
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Revenue" title="Invoices" subtitle="Commission and advisory-fee invoices with UAE VAT or India GST and s.194H TDS, payments received, bank reconciliation and the returns they feed." />
      <section className="my-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Invoices" value={String(rows.length)} />
        <StatCard label="Outstanding" value={formatLocal(outstanding, "AED")} note={`${open.length} open`} />
        <StatCard label="Overdue" value={String(rows.filter((r) => r.invoice.status === "overdue").length)} />
        <StatCard label="Paid" value={String(rows.filter((r) => r.invoice.status === "paid").length)} />
      </section>
      <SectionTabs base="/admin/invoices" tabs={TABS} active={tab} label="Invoice sections" />
      {tab === "invoices" && (
        <Section title="All invoices">
          <SimpleTable
            rows={rows}
            minWidth={1000}
            columns={[
              { key: "n", header: "Number", cell: (r) => <Link href={`/admin/invoices/${r.invoice.id}`} className="num font-medium text-navy-900 underline decoration-ink-200 underline-offset-4">{r.invoice.number}</Link> },
              { key: "k", header: "Kind", cell: (r) => (r.invoice.kind === "advisory_fee" ? "Advisory fee" : "Commission") },
              { key: "r", header: "Recipient", cell: (r) => r.invoice.recipient },
              { key: "d", header: "Deal", cell: (r) => <span className="num">{r.deal ?? "None"}</span> },
              { key: "a", header: "Total", numeric: true, cell: (r) => formatLocal(r.invoice.total, r.invoice.currency, { compact: false }) },
              { key: "t", header: "Tax", cell: (r) => `${r.invoice.tax.type}${r.invoice.tax.ratePct ? ` ${r.invoice.tax.ratePct}%` : ""}` },
              { key: "i", header: "Issued", cell: (r) => (r.invoice.issuedAt ? formatDate(r.invoice.issuedAt) : "Draft") },
              { key: "s", header: "Status", cell: (r) => <Flag tone={INVOICE_TONE[r.invoice.status]}>{r.invoice.status.replace("_", " ")}</Flag> },
            ]}
          />
        </Section>
      )}
      {tab === "reconcile" && (
        <Section title="Bank reconciliation" description="Upload or paste the statement; nothing is recorded until you apply the matches.">
          <ReconcilePanel />
        </Section>
      )}
      {tab === "tax" && (
        <Section title="Tax returns" description="Figures for the UAE VAT return and India GSTR-1 and 3B from issued invoices, and TDS withheld by payers for your Form 26AS reconciliation.">
          <TaxReportPanel />
        </Section>
      )}
    </PageContainer>
  );
}
