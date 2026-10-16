import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { InsightCard } from "@/components/intelligence/insight-card";
import { LiveRefresh } from "@/components/realtime/realtime-indicator";
import { PortfolioView } from "@/components/composites/portfolio-view";
import { PropertyCard } from "@/components/portal/property-card";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listInsights } from "@/lib/insights";
import { getPortfolio } from "@/lib/queries";
import { sceneFor } from "@/lib/media/subjects";
import { photosForProperties } from "@/lib/media/unsplash";
import { insightViews } from "@/lib/serialize";
import { formatMoney } from "@/lib/utils";
import { EmptyState } from "@/components/composites/empty-state";

export const metadata = { title: "Portfolio" };
export const dynamic = "force-dynamic";

export default async function PortfolioPage() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  if (!user.clientId) {
    return (
      <PageContainer>
        <EmptyState glyph="documents" headline="No client record is linked to this account" note="Your relationship manager links your login to your client record. Once linked, your holdings, reports and statements appear here." primary={{ label: "Message your adviser", href: "/client/messages" }} secondary={{ label: "Account settings", href: "/client/settings" }} />
      </PageContainer>
    );
  }
  const db = await getDb();
  const [p, insights] = await Promise.all([getPortfolio(db, user, user.clientId), listInsights(db, { ...user, role: "client" }, { limit: 4 })]);
  const media = await photosForProperties(p.holdings.map((h) => ({ seed: h.property.slug, city: h.property.city, community: h.property.community, kind: h.property.assetClass })));
  return (
    <PageContainer>
      <PageHeader eyebrow={`${p.client.type} · ${p.client.residency}`} title={p.client.name} subtitle={`${p.holdings.length} holdings across ${p.byCity.length === 1 ? `${p.byCommunity.length} ${p.byCity[0]!.city} communities` : `${p.byCity.length} cities`}. Values are independent valuations or the last registered comparable.`} rule={false} meta={<LiveRefresh name="portfolio" tables={[{ table: "portfolios", filter: `client_id=eq.${user.clientId}` }, { table: "insights" }]} />} />
      {p.holdings.length > 0 && (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Your properties">
          {p.holdings.map((h, i) => {
            const change = h.costAed ? ((h.currentValueAed - h.costAed) / h.costAed) * 100 : 0;
            return (
              <li key={h.id}>
                <PropertyCard
                  seed={h.property.slug}
                  media={media.get(h.property.slug) ?? { photo: null, scene: sceneFor(h.property.city) }}
                  ownSrc={h.property.imageUrl}
                  href={`/client/assistant?q=${encodeURIComponent(`How is ${h.property.name} performing?`)}`}
                  title={h.property.name}
                  place={`${h.unitLabel} · ${h.property.community}`}
                  priority={i < 4}
                  ribbon={h.status === "performing" ? { label: "Performing", tone: "mint" } : h.status === "watch" ? { label: "On watch", tone: "sun" } : { label: "Under construction", tone: "sky" }}
                  stats={[
                    { label: "Value", value: formatMoney(h.currentValueAed) },
                    { label: "Since purchase", value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, tone: change >= 0 ? "mint" : "coral" },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-10">
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
