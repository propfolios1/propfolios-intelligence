import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { toAed } from "@/lib/commission/engine";
import { listCommissions } from "@/lib/commission/service";
import { formatLocal } from "@/lib/format";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "My commissions" };
export const dynamic = "force-dynamic";

export default async function AnalystCommissions() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const rows = await listCommissions(await getDb(), user.tenantId, { userId: user.id });
  const mine = rows.flatMap((r) => r.splits.filter((x) => x.split.userId === user.id).map((x) => ({ ...x.split, deal: r.deal, currency: r.commission.currency, commissionStatus: r.commission.status, at: r.commission.createdAt })));
  const total = (f: (x: (typeof mine)[number]) => boolean) => mine.filter(f).reduce((a, x) => a + toAed(x.amount, x.currency), 0);
  return (
    <PageContainer>
      <PageHeader eyebrow="Execution" title="My commissions" subtitle="Your share of every closed deal, from the firm's commission structures, and where each stands: earned, approved, paid." />
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Earned" value={formatLocal(total(() => true), "AED")} note={`${mine.length} shares`} />
        <StatCard label="Approved, unpaid" value={formatLocal(total((x) => x.status === "approved"), "AED")} />
        <StatCard label="Paid" value={formatLocal(total((x) => x.status === "paid"), "AED")} />
      </section>
      <Section title="Shares">
        <SimpleTable
          rows={mine}
          empty="No commission shares yet; they appear when a deal you own closes."
          columns={[
            { key: "d", header: "Deal", cell: (x) => <Link href={`/analyst/deals/${x.deal.id}`} className="num whitespace-nowrap text-navy-900 underline decoration-ink-200 underline-offset-4">{x.deal.reference}</Link> },
            { key: "t", header: "Deal", cell: (x) => x.deal.title },
            { key: "l", header: "Share", cell: (x) => `${x.label}, ${x.percentage}%` },
            { key: "a", header: "Amount", numeric: true, cell: (x) => formatLocal(x.amount, x.currency, { compact: false }) },
            { key: "w", header: "Earned", cell: (x) => formatDate(x.at) },
            { key: "s", header: "Status", cell: (x) => <Flag tone={x.status === "paid" ? "complete" : x.status === "approved" ? "progress" : "neutral"}>{x.status}</Flag> },
            { key: "c", header: "Firm collection", cell: (x) => x.commissionStatus.replace("_", " ") },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
