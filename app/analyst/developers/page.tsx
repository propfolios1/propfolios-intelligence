import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { DevelopersTable } from "@/components/composites/tables/developers-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listDevelopers } from "@/lib/queries";

export const metadata = { title: "Developers" };
export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const rows = await listDevelopers(await getDb(), user.tenantId);
  const avg = rows.reduce((a, d) => a + d.riskScore, 0) / rows.length;
  const elevated = rows.filter((d) => d.riskScore > 25).length;
  const best = [...rows].sort((a, b) => a.riskScore - b.riskScore)[0]!;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Research"
        title="Developer risk"
        subtitle="Composite score of delivery record (35%), financial health (25%), litigation (15%), market sentiment (15%) and escrow compliance (10%). Lower is stronger. Re-scored weekly by the developer risk agent."
      />
      <section className="mt-8 stat-row">
        <StatCard label="Developers scored" value={String(rows.length)} note={`${rows.filter((d) => d.market === "UAE").length} UAE, ${rows.filter((d) => d.market === "India").length} India`} />
        <StatCard label="Average risk score" value={avg.toFixed(1)} note={`${elevated} above 25`} />
        <StatCard label="Strongest" value={best.name} note={`Score ${best.riskScore.toFixed(1)}`} />
      </section>
      <div className="mt-8">
        <DevelopersTable rows={rows} />
      </div>
    </PageContainer>
  );
}
