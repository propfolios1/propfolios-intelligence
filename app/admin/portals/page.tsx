import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { ConnectPortal, PortalStatus } from "@/components/portals/portals";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { portalCards } from "@/lib/portals/view";

export const metadata = { title: "Portals" };
export const dynamic = "force-dynamic";

export default async function PortalsPage() {
  const user = await requireRole(["tenant_admin"]);
  const { cards, jobs } = await portalCards(await getDb(), user.tenantId);
  const failed = jobs.filter((j) => j.j.status === "failed").length;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Portals"
        subtitle="Connect each portal once; then publish, update and remove listings from the listing page. Supabase Cron sends queued work every fifteen minutes, respects each portal's rate limit, retries failures and polls moderation status."
        actions={
          <Link href="/admin/portals/jobs" className="text-ui font-medium text-navy-900 underline underline-offset-4">
            Publish queue
          </Link>
        }
      />
      <section className="my-8 stat-row">
        <StatCard label="Connected portals" value={`${cards.filter((c) => c.connected).length} of ${cards.length}`} note={`${cards.filter((c) => c.sandbox).length} on the sandbox`} />
        <StatCard label="Live listings" value={String(cards.reduce((a, c) => a + c.live, 0))} note="Across connected portals" />
        <StatCard label="In moderation or queued" value={String(cards.reduce((a, c) => a + c.queued, 0))} note="Polled every 15 minutes" />
        <StatCard label="Needs attention" value={String(cards.reduce((a, c) => a + c.rejected, 0) + failed)} note="Rejected listings and failed jobs" />
      </section>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <li key={c.key} className="flex flex-col rounded-md border border-hairline bg-surface p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[16px] font-medium text-navy-900">{c.name}</h2>
                <p className="mt-0.5 text-[12px] text-ink-500">
                  <span aria-hidden>{c.flag}</span> {c.market} · {c.transport === "rtdf" ? "Real Time Datafeed" : c.transport === "zoopla" ? "Real-time Listings API" : "Partner API"}
                </p>
              </div>
              {c.connected ? <PortalStatus status={c.sandbox ? "sandbox" : (c.status ?? "connected")} /> : null}
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-hairline pt-4">
              {[
                ["Live", c.live],
                ["Queued", c.queued],
                ["Issues", c.rejected],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="label-caps">{k}</dt>
                  <dd className={`num mt-1 text-[20px] ${k === "Issues" && Number(v) > 0 ? "text-danger" : "text-ink-900"}`}>{v}</dd>
                </div>
              ))}
            </dl>
            {c.lastError && <p className="mt-3 line-clamp-2 text-[12px] text-danger" title={c.lastError}>{c.lastError}</p>}
            <div className="mt-auto flex items-center gap-3 pt-5">
              <ConnectPortal portal={c} label={c.connected ? "Edit connection" : "Connect"} />
              {c.connected && (
                <Link href={`/admin/portals/${c.key}`} className="text-ui whitespace-nowrap text-navy-900 hover:underline">
                  Field map
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
