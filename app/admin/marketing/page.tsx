import Link from "next/link";
import { and, desc, inArray, sql } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { MarketingTabs } from "@/components/marketing/tabs";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";
import { PlanNotice } from "@/components/billing/plan-notice";
import { tenantPlan } from "@/lib/plan-gate";

export const metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";

const KIND = { one_off: "One-off", sequence: "Sequence", auto_promote: "Auto-promote" } as const;
const TONE = { draft: "neutral", scheduled: "progress", sent: "complete", completed: "complete", active: "progress", paused: "neutral" } as const;

export default async function Marketing() {
  const user = await requireRole(["tenant_admin"]);
  const plan = await tenantPlan(user.tenantId);
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [campaigns, sends, posts] = await Promise.all([
    db.select().from(s.campaigns).where(scope(s.campaigns, user.tenantId, inArray(s.campaigns.kind, ["one_off", "sequence", "auto_promote"]))).orderBy(desc(s.campaigns.createdAt)).limit(60),
    db.select({ campaignId: s.campaignSends.campaignId, status: s.campaignSends.status, n: sql<number>`count(*)::int` }).from(s.campaignSends).where(scope(s.campaignSends, user.tenantId)).groupBy(s.campaignSends.campaignId, s.campaignSends.status),
    db.select({ status: s.socialPosts.status, n: sql<number>`count(*)::int` }).from(s.socialPosts).where(and(scope(s.socialPosts, user.tenantId), sql`${s.socialPosts.scheduledAt} >= ${since}`)).groupBy(s.socialPosts.status),
  ]);
  const count = (id: string, st: string) => sends.find((x) => x.campaignId === id && x.status === st)?.n ?? 0;
  const total = (st: string) => sends.filter((x) => x.status === st).reduce((a, x) => a + x.n, 0);
  const live = campaigns.filter((c) => c.active);
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Marketing" subtitle="Email and WhatsApp sequences, one-off sends to saved audiences, automatic promotion of every new and reduced listing, and scheduled posts on the firm's social accounts. Only leads who consented to marketing are ever contacted." />
      <PlanNotice plan={plan} module="marketing" />
      <MarketingTabs active="/admin/marketing" />
      <section className="my-8 stat-row">
        <StatCard label="Running" value={String(live.length)} note={`${live.filter((c) => c.kind === "auto_promote").length} auto-promotion ${live.filter((c) => c.kind === "auto_promote").length === 1 ? "rule" : "rules"}`} />
        <StatCard label="Messages sent" value={String(total("sent"))} note={`${total("scheduled")} scheduled`} />
        <StatCard label="Stopped or skipped" value={String(total("skipped"))} note="Replied, closed or opted out" />
        <StatCard label="Social posts, 30 days" value={String(posts.reduce((a, p) => a + p.n, 0))} note={`${posts.find((p) => p.status === "published")?.n ?? 0} published`} />
      </section>
      <Section title="Campaigns">
        <SimpleTable
          rows={campaigns}
          minWidth={900}
          empty="No campaigns yet. Start with a welcome sequence for new buyer leads."
          columns={[
            { key: "n", header: "Campaign", cell: (c) => <Link href={`/admin/marketing/campaigns/${c.id}`} className="text-ink-900 underline-offset-4 hover:underline">{c.name}</Link> },
            { key: "k", header: "Type", cell: (c) => KIND[c.kind] },
            { key: "s", header: "Status", cell: (c) => <StatusPill tone={TONE[c.status]}>{c.status}</StatusPill> },
            { key: "a", header: "Audience", numeric: true, cell: (c) => c.metrics.audience || "" },
            { key: "se", header: "Sent", numeric: true, cell: (c) => count(c.id, "sent") },
            { key: "sc", header: "Scheduled", numeric: true, cell: (c) => count(c.id, "scheduled") },
            { key: "sk", header: "Skipped", numeric: true, cell: (c) => count(c.id, "skipped") },
            { key: "d", header: "Created", cell: (c) => <RelativeTime iso={c.createdAt.toISOString()} /> },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
