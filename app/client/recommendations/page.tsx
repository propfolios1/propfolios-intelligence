import { PageHeader } from "@/components/composites/page-header";
import { RecommendationsList } from "@/components/composites/recommendations-list";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { sceneFor } from "@/lib/media/subjects";
import { photosForProperties } from "@/lib/media/unsplash";
import { listRecommendations } from "@/lib/queries";

export const metadata = { title: "Recommendations" };
export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const rows = user.clientId ? await listRecommendations(await getDb(), user, { clientId: user.clientId, status: "open" }) : [];
  const media = await photosForProperties(rows.flatMap((x) => (x.propertySlug && x.propertyCity ? [{ seed: x.propertySlug, city: x.propertyCity, community: x.propertyCommunity, kind: x.propertyAssetClass }] : [])));
  return (
    <PageContainer>
      <PageHeader eyebrow="Advisory" title="Recommendations" subtitle={`${rows.length} open ${rows.length === 1 ? "action" : "actions"} drawn from your holdings, policy limits and the market.`} />
      <RecommendationsList
        items={rows.map((x) => ({
          id: x.r.id,
          type: x.r.type,
          title: x.r.title,
          message: x.r.message,
          rationale: x.r.rationale,
          priority: x.r.priority,
          createdAt: x.r.createdAt.toISOString(),
          propertyName: x.propertyName,
          visual: x.propertySlug && x.propertyCity ? { seed: x.propertySlug, place: `${x.propertyCommunity}, ${x.propertyCity}`, ownSrc: x.propertyImageUrl, media: media.get(x.propertySlug) ?? { photo: null, scene: sceneFor(x.propertyCity) } } : null,
        }))}
      />
    </PageContainer>
  );
}
