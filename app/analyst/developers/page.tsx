import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { DevelopersTable } from "@/components/tables/developers-table";
import { developers } from "@/lib/data/store";

export const metadata = { title: "Developer Risk" };

export default function DevelopersPage() {
  const high = developers.filter((d) => d.riskScore > 60).length;
  const avgDelivery = developers.reduce((s, d) => s + d.deliveryPct, 0) / developers.length;
  const unverified = developers.filter((d) => !d.escrowCompliant).length;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Counterparty"
        title="Developer risk"
        subtitle="Scored 0–100 by the developer-risk agent from delivery record, litigation, scale and escrow compliance. Higher is riskier."
      />
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Developers tracked" value={String(developers.length)} />
        <StatCard label="High risk" value={String(high)} />
        <StatCard label="Avg on-time delivery" value={avgDelivery.toFixed(0)} unit="%" />
      </div>
      <div className="mt-10">
        <DevelopersTable rows={developers} />
      </div>
      {unverified > 0 && (
        <p className="mt-4 text-xs text-ink-500">
          <span className="num">{unverified}</span> developers have escrow accounts that could not be verified against regulator filings.
        </p>
      )}
    </PageContainer>
  );
}
