import { PageHeader } from "@/components/composites/page-header";
import { RecommendationsList } from "@/components/composites/recommendations-list";
import { PageContainer } from "@/components/shell/page-container";
import { clientRecommendations, DEMO_CLIENT_ID, getProperty } from "@/lib/data/store";

export const metadata = { title: "Recommendations" };

export default function RecommendationsPage() {
  const items = clientRecommendations.filter((r) => r.clientId === DEMO_CLIENT_ID).map((r) => ({ ...r, propertyName: r.propertyId ? getProperty(r.propertyId)?.name : undefined }));
  return (
    <PageContainer>
      <PageHeader eyebrow="This week" title="Recommendations" subtitle={`${items.length} actions, drawn from your holdings, policy limits and the market.`} />
      <RecommendationsList items={items} />
    </PageContainer>
  );
}
