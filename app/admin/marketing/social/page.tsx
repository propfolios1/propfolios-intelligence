import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { ConnectSocial, SocialComposer } from "@/components/marketing/automation";
import { MarketingTabs } from "@/components/marketing/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { SOCIAL_NETWORKS } from "@/db/schema-production";
import { requireRole } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Social" };
export const dynamic = "force-dynamic";

export default async function Social() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [accounts, posts, listings, [site]] = await Promise.all([
    db.select().from(s.socialAccounts).where(scope(s.socialAccounts, user.tenantId)),
    db.select().from(s.socialPosts).where(scope(s.socialPosts, user.tenantId)).orderBy(desc(s.socialPosts.scheduledAt)).limit(40),
    db.select({ id: s.listings.id, title: s.listings.title, photos: s.listings.photos, reference: s.listings.reference }).from(s.listings).where(scope(s.listings, user.tenantId, eq(s.listings.status, "active"))).orderBy(desc(s.listings.createdAt)).limit(40),
    db.select({ slug: s.websiteConfigs.slug, publishedAt: s.websiteConfigs.publishedAt }).from(s.websiteConfigs).where(eq(s.websiteConfigs.tenantId, user.tenantId)),
  ]);
  const base = site?.publishedAt ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/sites/${site.slug}` : null;
  const connected = accounts.filter((a) => a.status === "connected");
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Marketing" title="Social" subtitle="Schedule posts to Instagram, Facebook, LinkedIn, X and TikTok from one composer. Each network's own limits are applied: X is shortened to 280 characters, Instagram and TikTok need an image." />
      <MarketingTabs active="/admin/marketing/social" />
      <Section title="Accounts" description="Live publishing uses the firm's own access token for each network. The sandbox records what would be posted, for rehearsal.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {SOCIAL_NETWORKS.map((nw) => {
            const a = accounts.find((x) => x.network === nw);
            return <ConnectSocial key={nw} network={nw} connected={a ? { mode: a.mode, displayName: a.displayName } : null} />;
          })}
        </div>
      </Section>
      <Section title="New post">
        <SocialComposer networks={connected.map((a) => a.network)} listings={listings.map((l) => ({ id: l.id, title: l.title, photos: l.photos.map((p) => p.url), url: base ? `${base}/listings/${l.reference.toLowerCase()}` : null }))} />
      </Section>
      <Section title="Scheduled and published">
        <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
          {posts.map((p) => (
            <li key={p.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="truncate text-ui text-ink-900">{p.caption}</p>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  {p.networks
                    .map((n) => {
                      const r = p.results[n];
                      return `${n}${r ? `: ${r.status}${r.error ? ` (${r.error})` : ""}` : ""}`;
                    })
                    .join(" · ")}
                </p>
              </div>
              <span className="flex items-center gap-2 text-[12px] text-ink-500">
                <RelativeTime iso={p.scheduledAt.toISOString()} />
                <StatusPill tone={p.status === "published" ? "complete" : p.status === "failed" ? "error" : p.status === "partial" ? "progress" : "neutral"}>{p.status}</StatusPill>
              </span>
            </li>
          ))}
          {!posts.length && <li className="px-4 py-6 text-ui text-ink-500">Nothing scheduled yet.</li>}
        </ul>
      </Section>
    </PageContainer>
  );
}
