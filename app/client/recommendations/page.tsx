import { PageHeader } from "@/components/composites/page-header";
import { RecommendationsList } from "@/components/composites/recommendations-list";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listRecommendations } from "@/lib/queries";

export const metadata = { title: "Recommendations" };
export const dynamic = "force-dynamic";

export default async function RecommendationsPage() {
  const user = await requireRole(["admin", "analyst", "client"]);
  const rows = user.clientId ? await listRecommendations(await getDb(), user, { clientId: user.clientId, status: "open" }) : [];
  return (
    <PageContainer>
      <PageHeader eyebrow="Advisory" title="Recommendations" subtitle={`${rows.length} open actions drawn from your holdings, policy limits and the market.`} />
      <RecommendationsList items={rows.map(({ r, propertyName }) => ({ id: r.id, type: r.type, title: r.title, message: r.message, rationale: r.rationale, priority: r.priority, createdAt: r.createdAt.toISOString(), propertyName }))} />
    </PageContainer>
  );
}
