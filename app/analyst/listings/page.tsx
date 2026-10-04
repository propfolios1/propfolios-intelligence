import Link from "next/link";
import { CreateListing } from "@/components/brokerage/actions";
import { marketOptions } from "@/components/brokerage/market-options";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { LISTING_STATUS_LABEL, listingIssues, listListings } from "@/lib/brokerage/listings";
import { formatLocal } from "@/lib/format";
import { PORTAL_INDEX } from "@/lib/markets";

export const metadata = { title: "Listings" };
export const dynamic = "force-dynamic";

const TONE = { draft: "neutral", active: "progress", under_offer: "progress", sold: "complete", let: "complete", withdrawn: "neutral" } as const;

export default async function ListingsPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const rows = await listListings(await getDb(), user.tenantId);
  const active = rows.filter((r) => r.listing.status === "active");
  const live = rows.reduce((a, r) => a + r.portals.filter((p) => p.status === "live").length, 0);
  const blocked = rows.filter((r) => r.listing.status !== "sold" && r.listing.status !== "let" && listingIssues(r.listing).length);
  const enquiries = rows.reduce((a, r) => a + r.enquiries, 0);
  const days = active.filter((r) => r.listing.listedAt).map((r) => (Date.now() - r.listing.listedAt!.getTime()) / 86_400_000);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Brokerage"
        title="Listings"
        subtitle="Every instruction the firm holds, checked against what each portal requires before it goes out: the permit, the copy and the photographs. Portals pull a signed feed; enquiries come back as scored leads."
        actions={<CreateListing markets={marketOptions()} />}
      />
      <section className="my-8 stat-row">
        <StatCard label="Active listings" value={String(active.length)} note={`${rows.length} instructions in total`} />
        <StatCard label="Live on portals" value={String(live)} note="Listing and portal pairs" />
        <StatCard label="Enquiries" value={String(enquiries)} note="Leads linked to a listing" />
        <StatCard label="Average days listed" value={days.length ? String(Math.round(days.reduce((a, b) => a + b, 0) / days.length)) : "None"} note={blocked.length ? `${blocked.length} held back by a portal requirement` : "None held back"} />
      </section>
      <SimpleTable
        rows={rows}
        minWidth={1080}
        empty="No listings yet. Create one, add the permit and photographs, then activate and syndicate it."
        columns={[
          { key: "r", header: "Listing", cell: (r) => <Link href={`/analyst/listings/${r.listing.id}`} className="text-ink-900 hover:underline"><span className="num">{r.listing.reference}</span> · {r.listing.title}</Link> },
          { key: "c", header: "Community", cell: (r) => `${r.listing.community}, ${r.listing.city}` },
          { key: "p", header: "Price", numeric: true, cell: (r) => `${formatLocal(r.listing.price, r.listing.currency)}${r.listing.rentPeriod ? (r.listing.rentPeriod === "monthly" ? " / mo" : " / yr") : ""}` },
          { key: "s", header: "Status", cell: (r) => <Flag tone={TONE[r.listing.status]}>{LISTING_STATUS_LABEL[r.listing.status]}</Flag> },
          { key: "po", header: "Portals", cell: (r) => (r.portals.length ? r.portals.map((p) => `${PORTAL_INDEX[p.portal]?.name ?? p.portal}${p.status === "live" ? "" : ` (${p.status})`}`).join(", ") : "None") },
          { key: "e", header: "Enquiries", numeric: true, cell: (r) => r.enquiries },
          { key: "v", header: "Views", numeric: true, cell: (r) => r.listing.views.toLocaleString("en-US") },
          { key: "a", header: "Agent", cell: (r) => r.agent ?? "Unassigned" },
        ]}
      />
    </PageContainer>
  );
}
