import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { InsightCard } from "@/components/intelligence/insight-card";
import { LiveRefresh } from "@/components/realtime/realtime-indicator";
import { PortfolioView } from "@/components/composites/portfolio-view";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listInsights } from "@/lib/insights";
import { getPortfolio } from "@/lib/queries";
import { insightViews } from "@/lib/serialize";
import { EmptyState } from "@/components/composites/empty-state";

export const metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  if (!user.clientId) {
    return (
      <PageContainer>
        <EmptyState glyph="documents" headline="No client record is linked to this account." note="Ask your relationship manager to link your account." />
      </PageContainer>
    );
  }
  const db = await getDb();
  const [p, insights] = await Promise.all([getPortfolio(db, user, user.clientId), listInsights(db, { ...user, role: "client" }, { limit: 4 })]);
  return (
    <PageContainer>
      <PageHeader eyebrow={`${p.client.type} · ${p.client.residency}`} title={p.client.name} subtitle={`${p.holdings.length} holdings across ${p.byCity.length === 1 ? `${p.byCommunity.length} ${p.byCity[0]!.city} communities` : `${p.byCity.length} cities`}. Values are independent valuations or the last registered comparable.`} rule={false} meta={<LiveRefresh name="portfolio" tables={[{ table: "portfolios", filter: `client_id=eq.${user.clientId}` }, { table: "insights" }]} />} />
      <div className="mt-8">
        <PortfolioView p={p} recommendationsHref="/client/recommendations" />
      </div>
      {insights.length > 0 && (
        <section className="mt-10" aria-labelledby="client-insights">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="client-insights" className="font-display text-section text-navy-900">
              Insights
            </h2>
            <Link href="/client/insights" className="text-small text-ink-700 hover:text-ink-900">
              All insights
            </Link>
          </div>
          <div className="rounded-md border border-hairline bg-surface px-6 shadow-card">
            {insightViews(insights).map((i) => (
              <InsightCard key={i.id} insight={i} />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  );
}
