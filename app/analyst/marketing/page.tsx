import { asc, desc, eq } from "drizzle-orm";
import { CampaignComposer, SendCampaign } from "@/components/brokerage/actions";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { SEGMENTS, type SegmentKey, segmentMembers } from "@/lib/brokerage/marketing";
import { formatLocal } from "@/lib/format";
import { scope } from "@/lib/tenant-db";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Marketing" };
export const dynamic = "force-dynamic";

const TONE = { draft: "neutral", scheduled: "progress", sent: "complete", completed: "complete" } as const;
const CHANNEL: Record<string, string> = { email: "Email", social: "Social", portal_boost: "Portal boost", print: "Print" };
const rate = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "None");

export default async function MarketingPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [campaigns, listings, segs] = await Promise.all([
    db.select({ c: s.campaigns, listing: s.listings.title }).from(s.campaigns).leftJoin(s.listings, eq(s.listings.id, s.campaigns.listingId)).where(scope(s.campaigns, user.tenantId)).orderBy(desc(s.campaigns.createdAt)),
    db.select({ id: s.listings.id, name: s.listings.title }).from(s.listings).where(scope(s.listings, user.tenantId, eq(s.listings.status, "active"))).orderBy(asc(s.listings.title)),
    Promise.all((Object.keys(SEGMENTS) as SegmentKey[]).map(async (k) => ({ key: k, label: SEGMENTS[k].label, size: (await segmentMembers(db, user.tenantId, k)).length }))),
  ]);
  const sent = campaigns.filter((r) => r.c.status === "sent" || r.c.status === "completed");
  const emails = sent.filter((r) => r.c.channel === "email");
  const totals = emails.reduce((a, r) => ({ sent: a.sent + r.c.metrics.sent, opened: a.opened + r.c.metrics.opened, clicked: a.clicked + r.c.metrics.clicked }), { sent: 0, opened: 0, clicked: 0 });
  const leads = sent.reduce((a, r) => a + r.c.metrics.leads, 0);
  const consented = segs.find((x) => x.key === "all")?.size ?? 0;
  return (
    <PageContainer>
      <PageHeader eyebrow="Brokerage" title="Marketing" subtitle="Email and social campaigns to leads who consented to hear from the firm, drafted by the campaign writer from the listing's facts and sent from the firm's own outbox." actions={<CampaignComposer segments={segs} listings={listings} />} />
      <section className="my-8 stat-row">
        <StatCard label="Marketable contacts" value={String(consented)} note="Open leads with marketing consent" />
        <StatCard label="Email open rate" value={rate(totals.opened, totals.sent)} note={`${totals.sent} emails sent`} />
        <StatCard label="Click rate" value={rate(totals.clicked, totals.sent)} note="Of emails sent" />
        <StatCard label="Leads attributed" value={String(leads)} note={`From ${sent.length} campaigns`} />
      </section>
      <Section title="Campaigns">
        <SimpleTable
          rows={campaigns}
          minWidth={1040}
          empty="No campaigns yet."
          columns={[
            { key: "n", header: "Campaign", cell: (r) => <span className="text-ink-900">{r.c.name}</span> },
            { key: "ch", header: "Channel", cell: (r) => CHANNEL[r.c.channel] ?? r.c.channel },
            { key: "a", header: "Audience", cell: (r) => SEGMENTS[r.c.segment as SegmentKey]?.label ?? r.c.segment },
            { key: "s", header: "Status", cell: (r) => <Flag tone={TONE[r.c.status]}>{r.c.status}</Flag> },
            { key: "se", header: "Sent", numeric: true, cell: (r) => (r.c.metrics.sent ? r.c.metrics.sent.toLocaleString("en-US") : "None") },
            { key: "o", header: "Opened", numeric: true, cell: (r) => (r.c.channel === "email" && r.c.metrics.sent ? rate(r.c.metrics.opened, r.c.metrics.sent) : "None") },
            { key: "c", header: "Clicks", numeric: true, cell: (r) => r.c.metrics.clicked },
            { key: "l", header: "Leads", numeric: true, cell: (r) => r.c.metrics.leads },
            { key: "sp", header: "Spend", numeric: true, cell: (r) => (r.c.budget && r.c.currency ? formatLocal(r.c.budget, r.c.currency) : "None") },
            { key: "d", header: "Date", cell: (r) => (r.c.sentAt ? formatDate(r.c.sentAt) : r.c.status === "draft" && r.c.channel === "email" ? <SendCampaign id={r.c.id} audience={segs.find((x) => x.key === r.c.segment)?.size ?? 0} /> : "Draft") },
          ]}
        />
      </Section>
      <Section title="Audiences" description="Only open leads who consented to marketing are included. Withdrawing consent on a lead removes it from every audience at once.">
        <SimpleTable
          rows={segs}
          minWidth={480}
          columns={[
            { key: "l", header: "Audience", cell: (r) => r.label },
            { key: "n", header: "Contacts", numeric: true, cell: (r) => r.size },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
