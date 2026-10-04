import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/composites/page-header";
import { FieldMapEditor, PortalStatus } from "@/components/portals/portals";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { PORTAL_SPECS } from "@/lib/portals/specs";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Portal field map" };
export const dynamic = "force-dynamic";

export default async function PortalPage({ params }: { params: Promise<{ portal: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { portal } = await params;
  const spec = PORTAL_SPECS[portal];
  if (!spec) notFound();
  const db = await getDb();
  const [conn] = await db.select().from(s.portalConnections).where(scope(s.portalConnections, user.tenantId, eq(s.portalConnections.portal, portal)));
  const listings = await db
    .select({ pl: s.portalListings, reference: s.listings.reference, title: s.listings.title })
    .from(s.portalListings)
    .innerJoin(s.listings, eq(s.listings.id, s.portalListings.listingId))
    .where(and(scope(s.portalListings, user.tenantId), eq(s.portalListings.portal, portal)))
    .orderBy(desc(s.portalListings.updatedAt))
    .limit(100);
  const rules = (conn?.fieldMap ?? spec.fieldMap) as { target: string; source: string; value?: string | number | boolean; map?: Record<string, string | number | boolean>; required?: boolean }[];
  return (
    <PageContainer>
      <PageHeader eyebrow="Portals" title={spec.name} subtitle={`${conn?.config.sandboxMode === "true" ? "Connected to the Nakhla sandbox. " : conn ? "Connected. " : "Not connected. "}Each row maps a Nakhla listing field to the portal's field. Value maps translate Nakhla values into the portal's codes; required fields block publishing until the listing has them.`} />
      <Section title="Field map" description="Defaults follow the portal's published listing specification. Change a field name if your partner account manager specifies a different one.">
        <FieldMapEditor portal={portal} rules={rules} custom={Boolean(conn?.fieldMap)} />
      </Section>
      <Section title="Listings on this portal">
        <SimpleTable
          rows={listings}
          minWidth={820}
          empty="Nothing published yet."
          columns={[
            { key: "r", header: "Listing", cell: (r) => `${r.reference} · ${r.title}` },
            { key: "s", header: "Status", cell: (r) => <PortalStatus status={r.pl.status} /> },
            { key: "e", header: "Portal reference", cell: (r) => r.pl.externalId ?? "" },
            { key: "p", header: "Published", cell: (r) => r.pl.publishedAt?.toISOString().slice(0, 10) ?? "" },
            { key: "x", header: "Last message", cell: (r) => <span className={r.pl.lastError ? "text-danger" : ""}>{r.pl.lastError ?? ""}</span> },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
