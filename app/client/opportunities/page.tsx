import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { PropertyCard } from "@/components/composites/property-card";
import { RequestReview } from "@/components/composites/request-review";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { getPortfolio, listProperties } from "@/lib/queries";

export const metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireRole(["admin", "analyst", "client"]);
  const { q } = await searchParams;
  const db = await getDb();
  const all = await listProperties(db, { q });
  let markets: string[] = ["UAE", "India"];
  let held = new Set<string>();
  if (user.clientId) {
    const p = await getPortfolio(db, user, user.clientId);
    markets = p.client.policy.markets;
    held = new Set(p.holdings.map((h) => h.propertyId));
  }
  const lots = all.filter((p) => markets.includes(p.market) && !held.has(p.id)).sort((a, b) => b.grossYield - a.grossYield);
  return (
    <PageContainer>
      <PageHeader eyebrow="Screened against your investment policy" title="Opportunities" subtitle={`${lots.length} projects in ${markets.join(" and ")} that you do not already hold, ranked by gross yield.${q ? ` Filtered by “${q}”.` : ""}`} />
      {lots.length === 0 ? (
        <EmptyState glyph="opportunities" headline="No opportunities match your policy." />
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lots.map((p) => (
            <li key={p.id} id={p.slug}>
              <PropertyCard p={p} href={`/client/assistant?q=${encodeURIComponent(`Tell me about ${p.name} in ${p.community}`)}`} action={<RequestReview propertyName={p.name} />} />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
