import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingStatusControl, ListingWriter, Syndicate } from "@/components/brokerage/actions";
import { PageHeader } from "@/components/composites/page-header";
import { PublishPanel } from "@/components/portals/portals";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { CopyButton } from "@/components/ui/copy-button";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { feedUrl } from "@/lib/brokerage/feed-token";
import { STAGE_LABEL } from "@/lib/brokerage/leads";
import { getListing, LISTING_STATUS_LABEL, listingIssues } from "@/lib/brokerage/listings";
import { formatLocal } from "@/lib/format";
import { marketOf, permitLabel, PORTAL_INDEX, SOURCE_NAME } from "@/lib/markets";
import { PORTAL_SPECS } from "@/lib/portals/specs";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Listing" };
export const dynamic = "force-dynamic";

const SYN_TONE = { queued: "progress", live: "complete", rejected: "error", paused: "neutral" } as const;

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const d = await getListing(db, user.tenantId, id);
  if (!d) notFound();
  const l = d.listing;
  const m = marketOf(l.market);
  const issues = listingIssues(l);
  const h = await headers();
  const base = process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const [t] = await db.select({ slug: s.tenants.slug }).from(s.tenants).where(eq(s.tenants.id, user.tenantId));
  const feedPortals = m.portals.filter((p) => p.feed);
  const [conns, published] = await Promise.all([db.select({ portal: s.portalConnections.portal, status: s.portalConnections.status }).from(s.portalConnections).where(scope(s.portalConnections, user.tenantId)), db.select().from(s.portalListings).where(scope(s.portalListings, user.tenantId, eq(s.portalListings.listingId, l.id)))]);
  const apiPortals = Object.values(PORTAL_SPECS).filter((p) => p.market === m.code);
  const publishRows = apiPortals.map((p) => {
    const pl = published.find((x) => x.portal === p.key);
    return { portal: p.key, name: p.name, connected: conns.some((c) => c.portal === p.key && c.status !== "disabled"), status: pl?.status ?? null, externalId: pl?.externalId ?? null, externalUrl: pl?.externalUrl ?? null, lastError: pl?.lastError ?? null, publishedAt: pl?.publishedAt?.toISOString() ?? null };
  });
  const facts: [string, string][] = [
    ["Purpose", l.purpose === "sale" ? "Sale" : "Rent"],
    ["Type", l.propertyType],
    ["Price", `${formatLocal(l.price, l.currency, { compact: false })}${l.rentPeriod ? (l.rentPeriod === "monthly" ? " a month" : " a year") : ""}`],
    ["Size", `${l.area.toLocaleString("en-US")} ${l.areaUnit === "sqm" ? "sq m" : "sq ft"}`],
    ["Bedrooms", l.bedrooms === null ? "Not applicable" : l.bedrooms === 0 ? "Studio" : String(l.bedrooms)],
    ["Bathrooms", l.bathrooms === null ? "Not stated" : String(l.bathrooms)],
    [permitLabel(m.code, l.city), l.permitNumber ?? "Not on file"],
    ["Agent", d.agent ?? "Unassigned"],
    ["Views", l.views.toLocaleString("en-US")],
  ];
  return (
    <PageContainer>
      <PageHeader
        eyebrow={`Listings · ${l.reference}`}
        title={l.title}
        subtitle={`${l.community}, ${l.city} · ${m.name}`}
        actions={<ListingStatusControl id={l.id} status={l.status} />}
        meta={
          <>
            <span>{LISTING_STATUS_LABEL[l.status]}</span>
            {l.listedAt && (
              <span>
                Listed <RelativeTime iso={l.listedAt.toISOString()} />
              </span>
            )}
            <span>Copy: {l.descriptionSource === "ai" ? "listing writer, reviewed" : "written by the agent"}</span>
          </>
        }
      />
      {issues.length > 0 && l.status !== "sold" && l.status !== "let" && (
        <div role="status" className="mt-8 rounded-md border border-warning/40 bg-surface p-4 text-ui text-ink-700">
          <div className="font-medium text-ink-900">Portals will reject this listing until these are resolved</div>
          <ul className="mt-2 list-disc ps-5">
            {issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Section title="Description">
            {l.description ? <p className="max-w-[72ch] text-read whitespace-pre-line text-ink-800">{l.description}</p> : <p className="text-ui text-ink-500">No description yet.</p>}
            {l.features.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {l.features.map((f) => (
                  <li key={f} className="rounded-full border border-hairline px-2.5 py-0.5 text-meta text-ink-700">
                    {f}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-6">
              <ListingWriter id={l.id} />
            </div>
          </Section>
          {publishRows.length > 0 && (
            <Section title="Publish to portals" description="One click sends the listing to each selected portal through its API. Moderation results arrive within minutes and are polled every fifteen.">
              <PublishPanel listingId={l.id} rows={publishRows} issues={issues} />
            </Section>
          )}
          <Section title="Feed syndication" description={`Portals that pull a listing feed in ${m.name}. Each pulls its own signed feed; a listing goes out when it is active and meets the portal's requirements.`}>
            <Syndicate id={l.id} portals={feedPortals.map((p) => ({ key: p.key, name: p.name }))} current={d.portals.map((p) => p.portal)} />
            <SimpleTable
              className="mt-6"
              rows={d.portals}
              minWidth={640}
              empty="Not syndicated yet."
              columns={[
                { key: "p", header: "Portal", cell: (r) => PORTAL_INDEX[r.portal]?.name ?? r.portal },
                { key: "s", header: "Status", cell: (r) => <Flag tone={SYN_TONE[r.status]}>{r.status}</Flag> },
                { key: "x", header: "Portal reference", cell: (r) => (r.externalRef ? <span className="num">{r.externalRef}</span> : "Assigned on first pull") },
                { key: "l", header: "Last pull", cell: (r) => (r.lastSyncedAt ? <RelativeTime iso={r.lastSyncedAt.toISOString()} /> : "Never") },
                { key: "i", header: "Issue", cell: (r) => r.issue ?? "None" },
              ]}
            />
            {t && (
              <div className="mt-6 space-y-2">
                <h3 className="label-caps">Feed addresses</h3>
                {feedPortals.map((p) => {
                  const url = feedUrl(base, t.slug, user.tenantId, p.key);
                  return (
                    <div key={p.key} className="flex items-center gap-3 text-meta">
                      <span className="w-32 shrink-0 text-ink-700">{p.name}</span>
                      {url ? (
                        <>
                          <code className="num min-w-0 flex-1 truncate text-ink-500">{url}</code>
                          <CopyButton value={url} label="Copy" />
                        </>
                      ) : (
                        <span className="text-ink-500">Set FEED_SECRET in the environment to issue feed addresses.</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
          <Section title="Enquiries">
            <SimpleTable
              rows={d.leads}
              minWidth={600}
              empty="No enquiries yet."
              columns={[
                { key: "r", header: "Lead", cell: (r) => <Link href={`/analyst/leads/${r.id}`} className="text-ink-900 hover:underline"><span className="num">{r.reference}</span> · {r.name}</Link> },
                { key: "s", header: "Source", cell: (r) => SOURCE_NAME[r.source] ?? r.source },
                { key: "st", header: "Stage", cell: (r) => STAGE_LABEL[r.stage] },
                { key: "sc", header: "Score", numeric: true, cell: (r) => r.score },
                { key: "d", header: "Arrived", cell: (r) => <RelativeTime iso={r.createdAt.toISOString()} /> },
              ]}
            />
          </Section>
        </div>
        <aside className="space-y-8 lg:pt-10">
          <section aria-label="Facts">
            <h2 className="label-caps mb-3">Facts</h2>
            <dl className="border-t border-hairline">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-hairline-row py-2.5 text-ui">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="num text-right text-ink-900">{v}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section aria-label="Media">
            <h2 className="label-caps mb-3">Media</h2>
            <p className="text-ui text-ink-700">
              <span className="num">{l.photos.length}</span> photographs{l.photos.length ? `: ${l.photos.map((p) => p.caption.toLowerCase()).join(", ")}` : ""}.
            </p>
            {l.virtualTourUrl && (
              <a href={l.virtualTourUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-ui text-navy-900 underline decoration-ink-300 underline-offset-4 hover:decoration-navy-900">
                Virtual tour
              </a>
            )}
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
