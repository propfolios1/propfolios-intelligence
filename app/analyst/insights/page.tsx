import { after } from "next/server";
import { PageHeader } from "@/components/composites/page-header";
import { FederationStats } from "@/components/intelligence/federation-stats";
import { InsightsFeed } from "@/components/intelligence/insight-card";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { federationStats } from "@/lib/federation";
import { dueFollowUps, listInsights, refreshIfStale } from "@/lib/insights";
import { insightViews } from "@/lib/serialize";

export const metadata = { title: "Insights" };
export const dynamic = "force-dynamic";

const KINDS = [
  ["price_movement", "Price movements"],
  ["developer_distress", "Developer distress"],
  ["undervalued", "Undervalued opportunities"],
  ["exit_window", "Exit windows"],
] as const;

export default async function AnalystInsights() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  after(() => refreshIfStale(db, user.tenantId).then(() => undefined, () => undefined));
  const [all, followUps, fed] = await Promise.all([listInsights(db, user, { limit: 200 }), dueFollowUps(db, user.tenantId), federationStats(db)]);
  const signals = all.filter((i) => i.kind !== "follow_up");
  const counts = Object.fromEntries(KINDS.map(([k]) => [k, signals.filter((i) => i.kind === k).length]));
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Layer 4 · proactive intelligence"
        title="Insights"
        subtitle="The insight agent scans every portfolio, developer and market series every six hours, and whenever new market data arrives, and raises what needs attention before anyone asks."
        meta={
          <>
            {KINDS.map(([k, label]) => (
              <span key={k}>
                {label} <span className="num text-ink-900">{counts[k]}</span>
              </span>
            ))}
          </>
        }
      />
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader eyebrow="Newest first" title="Signals" />
          <CardContent>
            <InsightsFeed insights={insightViews(signals)} staff />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardHeader eyebrow="From approved actions and escalations" title="Follow-ups" />
            <CardContent>
              <InsightsFeed insights={insightViews(followUps)} compact emptyText="No follow-ups scheduled." />
            </CardContent>
          </Card>
          <FederationStats stats={fed} variant="panel" />
        </div>
      </div>
    </PageContainer>
  );
}
