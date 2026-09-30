import { PageHeader } from "@/components/composites/page-header";
import { StatBlock } from "@/components/composites/stat-block";
import { DevelopersTable } from "@/components/composites/tables/developers-table";
import { PageContainer } from "@/components/shell/page-container";
import { developers } from "@/lib/data/store";

export const metadata = { title: "Developer risk" };

export default function DevelopersPage() {
  const high = developers.filter((d) => d.riskScore > 60);
  const avgDelivery = developers.reduce((s, d) => s + d.deliveryPct, 0) / developers.length;
  const unverified = developers.filter((d) => !d.escrowCompliant).length;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Counterparty"
        title="Developer risk"
        subtitle="Scored 0 to 100 from delivery record, litigation, scale and escrow. Higher is riskier. Rescored weekly."
      />
      <section className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-12">
        <StatBlock className="md:col-span-3" label="Tracked" value={String(developers.length)} note="UAE and India" />
        <StatBlock className="md:col-span-3" label="High risk" value={String(high.length)} note={high.map((d) => d.name.split(" ")[0]).join(", ")} />
        <StatBlock className="md:col-span-3" label="Avg on time" value={avgDelivery.toFixed(0)} unit="%" />
        <StatBlock className="md:col-span-3" label="Escrow unverified" value={String(unverified)} />
      </section>
      <div className="mt-16">
        <DevelopersTable rows={developers} />
      </div>
    </PageContainer>
  );
}
