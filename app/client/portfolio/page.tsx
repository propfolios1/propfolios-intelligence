import { PageHeader } from "@/components/composites/page-header";
import { PortfolioView } from "@/components/composites/portfolio-view";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { getPortfolio } from "@/lib/queries";
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
  const p = await getPortfolio(await getDb(), user, user.clientId);
  return (
    <PageContainer>
      <PageHeader eyebrow={`${p.client.type} · ${p.client.residency}`} title={p.client.name} subtitle={`${p.holdings.length} holdings across ${p.byCity.length === 1 ? `${p.byCommunity.length} ${p.byCity[0]!.city} communities` : `${p.byCity.length} cities`}. Values are independent valuations or the last registered comparable.`} rule={false} />
      <div className="mt-8">
        <PortfolioView p={p} recommendationsHref="/client/recommendations" />
      </div>
    </PageContainer>
  );
}
