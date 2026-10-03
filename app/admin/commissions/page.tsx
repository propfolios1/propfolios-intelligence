import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { SplitStatus } from "@/components/commission/invoice-actions";
import { Flag } from "@/components/os/badges";
import { RunAgent } from "@/components/os/run-agent";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { toAed } from "@/lib/commission/engine";
import { listCommissions } from "@/lib/commission/service";
import { formatLocal } from "@/lib/format";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Commissions" };
export const dynamic = "force-dynamic";

const TONE = { expected: "neutral", invoiced: "progress", received: "complete", paid_out: "complete", disputed: "error" } as const;

export default async function AdminCommissions() {
  const user = await requireRole(["tenant_admin"]);
  const rows = await listCommissions(await getDb(), user.tenantId);
  const sum = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((a, r) => a + toAed(r.commission.amount, r.commission.currency), 0);
  const [collections, ...anoms] = await Promise.all([lastOutput(user.tenantId, "collection-agent", null), ...rows.map((r) => lastOutput<{ headline: string; verdict?: string }>(user.tenantId, "anomaly-detector", r.commission.id))]);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration · Revenue"
        title="Commissions"
        subtitle="Computed when a deal closes from the applicable structure, split between the team and the firm, invoiced with VAT or GST and tracked to receipt. Every step is audited."
        actions={
          <div className="flex gap-3">
            <Link href="/admin/commissions/structures" className="inline-flex h-9 items-center rounded-sm border border-hairline bg-surface px-4 text-ui shadow-card hover:border-ink-400">
              Structures
            </Link>
            <Link href="/admin/invoices" className="inline-flex h-9 items-center rounded-sm bg-navy-900 px-4 text-ui text-surface hover:bg-navy-800">
              Invoices
            </Link>
          </div>
        }
      />
      <section className="mt-8 stat-row">
        <StatCard label="Commission earned" value={formatLocal(sum(() => true), "AED")} note={`${rows.length} deals, AED equivalent`} />
        <StatCard label="Invoiced, outstanding" value={formatLocal(sum((r) => r.commission.status === "invoiced"), "AED")} />
        <StatCard label="Received" value={formatLocal(sum((r) => r.commission.status === "received" || r.commission.status === "paid_out"), "AED")} />
        <StatCard label="Flagged for review" value={String(anoms.filter((a) => a?.output.verdict === "REVIEW").length)} note="Anomaly detector" />
      </section>
      <Section title="By deal">
        <SimpleTable
          rows={rows.map((r, i) => ({ ...r, anomaly: anoms[i] }))}
          minWidth={1100}
          empty="No commissions yet. They are computed automatically when a deal closes."
          columns={[
            { key: "d", header: "Deal", cell: (r) => <Link href={`/analyst/deals/${r.deal.id}`} className="num whitespace-nowrap text-navy-900 underline decoration-ink-200 underline-offset-4">{r.deal.reference}</Link> },
            { key: "c", header: "Client", cell: (r) => r.client },
            { key: "s", header: "Structure", cell: (r) => r.structure ?? "None" },
            { key: "v", header: "Deal value", numeric: true, cell: (r) => formatLocal(r.commission.grossDealValue, r.commission.currency) },
            { key: "a", header: "Commission", numeric: true, cell: (r) => formatLocal(r.commission.amount, r.commission.currency, { compact: false }) },
            { key: "p", header: "Rate", numeric: true, cell: (r) => `${r.commission.percentage.toFixed(2)}%` },
            { key: "st", header: "Status", cell: (r) => <Flag tone={TONE[r.commission.status]}>{r.commission.status.replace("_", " ")}</Flag> },
            { key: "i", header: "Invoice", cell: (r) => (r.invoice ? <Link href={`/admin/invoices/${r.invoice.id}`} className="num whitespace-nowrap text-navy-900 underline decoration-ink-200 underline-offset-4">{r.invoice.number}</Link> : "None") },
            { key: "an", header: "Review", cell: (r) => (r.anomaly ? <Flag tone={r.anomaly.output.verdict === "REVIEW" ? "error" : "complete"}>{r.anomaly.output.verdict ?? "checked"}</Flag> : "Pending") },
          ]}
        />
      </Section>
      <Section title="Splits" description="Approve each split, then mark it paid with payroll or the partner draw. When all splits are paid the commission is paid out.">
        <SimpleTable
          rows={rows.flatMap((r) => r.splits.map((x) => ({ ...x, deal: r.deal.reference, currency: r.commission.currency, commissionId: r.commission.id, created: r.commission.createdAt })))}
          minWidth={820}
          columns={[
            { key: "d", header: "Deal", cell: (x) => <span className="num whitespace-nowrap">{x.deal}</span> },
            { key: "l", header: "Share", cell: (x) => x.split.label },
            { key: "u", header: "Recipient", cell: (x) => x.user ?? "Firm" },
            { key: "p", header: "Percent", numeric: true, cell: (x) => `${x.split.percentage}%` },
            { key: "a", header: "Amount", numeric: true, cell: (x) => formatLocal(x.split.amount, x.currency, { compact: false }) },
            { key: "w", header: "Earned", cell: (x) => formatDate(x.created) },
            { key: "s", header: "", cell: (x) => <SplitStatus commissionId={x.commissionId} splitId={x.split.id} status={x.split.status} /> },
          ]}
        />
      </Section>
      <Section title="Receivables" eyebrow="Agent 28 · Collection agent">
        <RunAgent endpoint="/api/commissions/collections" body={{}} agentLabel="Collection agent" initial={collections ? { output: collections.output as never, model: collections.model, costUsd: collections.costUsd, at: collections.at } : null} />
      </Section>
    </PageContainer>
  );
}
