import { PageHeader } from "@/components/composites/page-header";
import { InsightsFeed } from "@/components/intelligence/insight-card";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listInsights } from "@/lib/insights";
import { insightViews } from "@/lib/serialize";

export const metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

export default async function ClientInsights() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const db = await getDb();
  const insights = user.clientId ? await listInsights(db, { ...user, role: "client" }, { limit: 50 }) : [];
  return (
    <PageContainer>
      <PageHeader eyebrow="Intelligence" title="Insights" subtitle="Developments that affect your holdings, identified by your advisory team's intelligence platform as they happen." />
      <Card className="mt-8">
        <CardContent className="pt-6">
          <InsightsFeed insights={insightViews(insights)} emptyText="Nothing requires your attention. New insights appear here the moment they are identified." />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
