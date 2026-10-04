import "server-only";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { ListingStatus } from "@/db/schema-brokerage";
import { HttpError } from "@/lib/auth";
import { marketOf, permitLabel, PORTAL_INDEX } from "@/lib/markets";
import { scope } from "@/lib/tenant-db";

export const LISTING_STATUS_LABEL: Record<ListingStatus, string> = { draft: "Draft", active: "Active", under_offer: "Under offer", sold: "Sold", let: "Let", withdrawn: "Withdrawn" };

export async function listListings(db: DB, tenantId: string) {
  const rows = await db.select({ listing: s.listings, agent: s.users.name }).from(s.listings).leftJoin(s.users, eq(s.users.id, s.listings.agentUserId)).where(scope(s.listings, tenantId)).orderBy(desc(s.listings.createdAt));
  const ids = rows.map((r) => r.listing.id);
  const [synd, enq] = ids.length
    ? await Promise.all([
        db.select({ listingId: s.listingSyndications.listingId, portal: s.listingSyndications.portal, status: s.listingSyndications.status }).from(s.listingSyndications).where(scope(s.listingSyndications, tenantId, inArray(s.listingSyndications.listingId, ids))),
        db.select({ listingId: s.leads.listingId, n: sql<number>`count(*)::int` }).from(s.leads).where(scope(s.leads, tenantId, inArray(s.leads.listingId, ids))).groupBy(s.leads.listingId),
      ])
    : [[], []];
  return rows.map((r) => ({ ...r, portals: synd.filter((x) => x.listingId === r.listing.id), enquiries: enq.find((e) => e.listingId === r.listing.id)?.n ?? 0 }));
}

export async function getListing(db: DB, tenantId: string, id: string) {
  const [row] = await db.select({ listing: s.listings, agent: s.users.name }).from(s.listings).leftJoin(s.users, eq(s.users.id, s.listings.agentUserId)).where(scope(s.listings, tenantId, eq(s.listings.id, id)));
  if (!row) return null;
  const [portals, leads] = await Promise.all([
    db.select().from(s.listingSyndications).where(scope(s.listingSyndications, tenantId, eq(s.listingSyndications.listingId, id))).orderBy(s.listingSyndications.portal),
    db.select({ id: s.leads.id, reference: s.leads.reference, name: s.leads.name, stage: s.leads.stage, score: s.leads.score, source: s.leads.source, createdAt: s.leads.createdAt }).from(s.leads).where(scope(s.leads, tenantId, eq(s.leads.listingId, id))).orderBy(desc(s.leads.createdAt)),
  ]);
  return { ...row, portals, leads };
}

/** What a portal will reject: checked before a listing is queued for syndication. */
export function listingIssues(l: typeof s.listings.$inferSelect): string[] {
  const m = marketOf(l.market);
  const issues: string[] = [];
  if (!l.permitNumber && (m.code === "AE" || m.code === "IN")) issues.push(`The ${permitLabel(m.code, l.city)} is required before advertising in ${m.name}.`);
  if (l.description.trim().length < 120) issues.push("Description under 120 characters; portals rank short descriptions lower.");
  if (l.photos.length < 5) issues.push(`${l.photos.length} photographs; most portals require at least five.`);
  if (!l.price || l.price <= 0) issues.push("No price.");
  return issues;
}

export async function syndicate(db: DB, tenantId: string, listingId: string, portals: string[]) {
  const [l] = await db.select().from(s.listings).where(scope(s.listings, tenantId, eq(s.listings.id, listingId)));
  if (!l) throw new HttpError(404, "Listing not found.");
  const m = marketOf(l.market);
  const allowed = new Set(m.portals.filter((p) => p.feed).map((p) => p.key));
  const bad = portals.filter((p) => !allowed.has(p));
  if (bad.length) throw new HttpError(422, `${bad.map((b) => PORTAL_INDEX[b]?.name ?? b).join(", ")} does not take listings in ${m.name}.`);
  const issues = listingIssues(l);
  const status = issues.length ? ("rejected" as const) : l.status === "active" ? ("queued" as const) : ("paused" as const);
  for (const portal of portals) {
    await db
      .insert(s.listingSyndications)
      .values({ tenantId, listingId, portal, status, issue: issues[0] ?? (status === "paused" ? "Listing is not active." : null) })
      .onConflictDoUpdate({ target: [s.listingSyndications.listingId, s.listingSyndications.portal], set: { status, issue: issues[0] ?? (status === "paused" ? "Listing is not active." : null), updatedAt: new Date() } });
  }
  return { status, issues };
}

export async function setListingStatus(db: DB, tenantId: string, listingId: string, status: ListingStatus) {
  const [l] = await db.update(s.listings).set({ status, ...(status === "active" ? { listedAt: sql`coalesce(${s.listings.listedAt}, now())` } : {}) }).where(scope(s.listings, tenantId, eq(s.listings.id, listingId))).returning();
  if (!l) throw new HttpError(404, "Listing not found.");
  // Portals drop listings that are no longer available on the next feed pull.
  if (status !== "active") await db.update(s.listingSyndications).set({ status: "paused", issue: `Listing is ${LISTING_STATUS_LABEL[status].toLowerCase()}.` }).where(and(eq(s.listingSyndications.listingId, listingId), eq(s.listingSyndications.status, "live")));
  return l;
}

const xml = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * The syndication feed a portal pulls: every active listing queued or live on
 * that portal, with the market's permit field. Pulling the feed marks queued
 * listings live.
 */
export async function portalFeed(db: DB, tenant: { id: string; name: string }, portal: string) {
  const p = PORTAL_INDEX[portal];
  if (!p || !p.feed) throw new HttpError(404, "Unknown portal feed.");
  const rows = await db
    .select({ l: s.listings, agent: s.users, sy: s.listingSyndications })
    .from(s.listingSyndications)
    .innerJoin(s.listings, eq(s.listings.id, s.listingSyndications.listingId))
    .leftJoin(s.users, eq(s.users.id, s.listings.agentUserId))
    .where(and(eq(s.listingSyndications.tenantId, tenant.id), eq(s.listingSyndications.portal, portal), inArray(s.listingSyndications.status, ["queued", "live"]), eq(s.listings.status, "active")));
  const now = new Date();
  const queued = rows.filter((r) => r.sy.status === "queued").map((r) => r.sy.id);
  if (queued.length) await db.update(s.listingSyndications).set({ status: "live", lastSyncedAt: now }).where(inArray(s.listingSyndications.id, queued));
  const items = rows
    .map(({ l, agent }) =>
      [
        `  <listing reference="${xml(l.reference)}" purpose="${l.purpose}" updated="${l.updatedAt.toISOString()}">`,
        `    <title>${xml(l.title)}</title>`,
        `    <type>${xml(l.propertyType)}</type>`,
        `    <price currency="${l.currency}"${l.rentPeriod ? ` period="${l.rentPeriod}"` : ""}>${l.price}</price>`,
        `    <location country="${l.market}" city="${xml(l.city)}" community="${xml(l.community)}"/>`,
        `    <size unit="${l.areaUnit}">${l.area}</size>`,
        l.bedrooms !== null ? `    <bedrooms>${l.bedrooms}</bedrooms>` : "",
        l.bathrooms !== null ? `    <bathrooms>${l.bathrooms}</bathrooms>` : "",
        l.permitNumber ? `    <permit>${xml(l.permitNumber)}</permit>` : "",
        `    <description><![CDATA[${l.description.replace(/]]>/g, "]]&gt;")}]]></description>`,
        `    <features>${l.features.map((f) => `<feature>${xml(f)}</feature>`).join("")}</features>`,
        `    <photos>${l.photos.map((ph) => `<photo caption="${xml(ph.caption)}">${xml(ph.url)}</photo>`).join("")}</photos>`,
        l.virtualTourUrl ? `    <virtual_tour>${xml(l.virtualTourUrl)}</virtual_tour>` : "",
        agent ? `    <agent name="${xml(agent.name)}" email="${xml(agent.email)}"/>` : "",
        `  </listing>`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<feed portal="${p.key}" agency="${xml(tenant.name)}" generated="${now.toISOString()}" count="${rows.length}">\n${items}\n</feed>\n`;
}
