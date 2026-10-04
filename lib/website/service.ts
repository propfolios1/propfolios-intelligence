import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { WebsiteSeo, WebsiteTheme } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { formatLocal } from "@/lib/format";
import { marketOf } from "@/lib/markets";
import { slugify } from "@/lib/tenant";
import { scope } from "@/lib/tenant-db";
import { type Block, defaultPages, parseBlock } from "./blocks";
import { THEMES } from "./themes";

/**
 * Brokerage websites. A firm edits draft pages; publishing copies each page's
 * blocks into website_blocks, which the public site renders. Listings, agents,
 * areas and market figures are read live (IDX), so a listing appears on the
 * site the moment it is made active and disappears when it is sold or let.
 */

export const sitesDomain = () => process.env.NAKHLA_SITES_DOMAIN || "nakhla.site";
const RESERVED = new Set(["www", "app", "api", "admin", "platform", "sites", "nakhla"]);

export async function ensureWebsite(db: DB, tenantId: string) {
  const [existing] = await db.select().from(s.websiteConfigs).where(eq(s.websiteConfigs.tenantId, tenantId));
  if (existing) return existing;
  const [t] = await db.select().from(s.tenants).where(eq(s.tenants.id, tenantId));
  if (!t) throw new HttpError(404, "Workspace not found.");
  const [l] = await db.select({ market: s.listings.market, city: s.listings.city }).from(s.listings).where(eq(s.listings.tenantId, tenantId)).limit(1);
  const m = marketOf(l?.market);
  let slug = slugify(t.slug || t.name) || "firm";
  if (RESERVED.has(slug)) slug = `${slug}-site`;
  for (let i = 2; (await db.select({ id: s.websiteConfigs.id }).from(s.websiteConfigs).where(eq(s.websiteConfigs.slug, slug))).length; i++) slug = `${slugify(t.slug || t.name)}-${i}`;
  const [cfg] = await db
    .insert(s.websiteConfigs)
    .values({ tenantId, slug, theme: "modern", domainToken: `nakhla-verify-${randomBytes(12).toString("hex")}`, seo: { title: `${t.name} | Property in ${m.name}`, description: `${t.name} buys, sells and lets property in ${m.name}. Browse current listings and speak to an agent.`, ogImage: null, keywords: [m.name, l?.city ?? "", "property", "real estate"].filter(Boolean), index: true } })
    .onConflictDoNothing()
    .returning();
  if (!cfg) return (await db.select().from(s.websiteConfigs).where(eq(s.websiteConfigs.tenantId, tenantId)))[0]!;
  const pages = defaultPages(t.name, m.name, l?.city ?? m.cities[0] ?? m.name);
  await db.insert(s.websitePages).values(pages.map((p, i) => ({ tenantId, slug: p.slug, title: p.title, blocks: p.blocks, position: i })));
  return cfg;
}

export async function getEditorData(db: DB, tenantId: string) {
  const cfg = await ensureWebsite(db, tenantId);
  const pages = await db.select().from(s.websitePages).where(eq(s.websitePages.tenantId, tenantId)).orderBy(asc(s.websitePages.position));
  return { cfg, pages };
}

export async function savePage(db: DB, tenantId: string, pageId: string, input: { title?: string; blocks?: { type: string; content: unknown }[] }) {
  const [page] = await db.select().from(s.websitePages).where(scope(s.websitePages, tenantId, eq(s.websitePages.id, pageId)));
  if (!page) throw new HttpError(404, "Page not found.");
  const blocks = input.blocks?.map((b) => parseBlock(b));
  const [row] = await db.update(s.websitePages).set({ ...(input.title ? { title: input.title } : {}), ...(blocks ? { blocks } : {}) }).where(eq(s.websitePages.id, page.id)).returning();
  return row!;
}

/** Moves a block within a page's draft: the order is what drag and drop produced. */
export function reorder(blocks: Block[], from: number, to: number): Block[] {
  if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return blocks;
  const next = [...blocks];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

export async function addPage(db: DB, tenantId: string, title: string) {
  const slug = slugify(title);
  if (!slug || slug === "sitemap-xml" || slug === "robots-txt") throw new HttpError(422, "Choose another page title.");
  const [{ n }] = (await db.select({ n: sql<number>`coalesce(max(${s.websitePages.position}), 0)::int` }).from(s.websitePages).where(eq(s.websitePages.tenantId, tenantId))) as [{ n: number }];
  const [row] = await db.insert(s.websitePages).values({ tenantId, slug, title, blocks: [{ type: "about", content: { title, body: "" } }], position: n + 1 }).onConflictDoNothing().returning();
  if (!row) throw new HttpError(409, `A page at /${slug} already exists.`);
  return row;
}

export async function deletePage(db: DB, tenantId: string, pageId: string) {
  const [page] = await db.select().from(s.websitePages).where(scope(s.websitePages, tenantId, eq(s.websitePages.id, pageId)));
  if (!page) throw new HttpError(404, "Page not found.");
  if (page.slug === "home") throw new HttpError(409, "The home page cannot be deleted.");
  await db.delete(s.websitePages).where(eq(s.websitePages.id, page.id));
}

export async function setTheme(db: DB, tenantId: string, theme: WebsiteTheme) {
  if (!THEMES[theme]) throw new HttpError(422, "Unknown theme.");
  await ensureWebsite(db, tenantId);
  await db.update(s.websiteConfigs).set({ theme }).where(eq(s.websiteConfigs.tenantId, tenantId));
}

export async function setSeo(db: DB, tenantId: string, seo: WebsiteSeo, contact?: { email: string | null; phone: string | null; whatsapp: string | null; address: string | null }) {
  await ensureWebsite(db, tenantId);
  await db.update(s.websiteConfigs).set({ seo, ...(contact ? { contact } : {}) }).where(eq(s.websiteConfigs.tenantId, tenantId));
}

/** Publishes every page's draft: website_blocks becomes the draft, in order. */
export async function publishSite(db: DB, tenantId: string) {
  const { pages } = await getEditorData(db, tenantId);
  for (const p of pages) {
    await db.delete(s.websiteBlocks).where(eq(s.websiteBlocks.websitePageId, p.id));
    if (p.blocks.length) await db.insert(s.websiteBlocks).values(p.blocks.map((b, i) => ({ tenantId, websitePageId: p.id, type: b.type, content: b.content, order: i })));
    await db.update(s.websitePages).set({ published: true }).where(eq(s.websitePages.id, p.id));
  }
  const [cfg] = await db.update(s.websiteConfigs).set({ publishedAt: new Date() }).where(eq(s.websiteConfigs.tenantId, tenantId)).returning();
  return cfg!;
}

/* ---------------------------------------------------------------- domains */

export type DnsResolver = { txt: (name: string) => Promise<string[][]>; cname: (name: string) => Promise<string[]> };

export async function systemResolver(): Promise<DnsResolver> {
  const dns = await import("node:dns/promises");
  return { txt: (n) => dns.resolveTxt(n), cname: (n) => dns.resolveCname(n) };
}

const cleanDomain = (d: string) =>
  d
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "");

export async function setCustomDomain(db: DB, tenantId: string, domain: string | null) {
  await ensureWebsite(db, tenantId);
  const d = domain ? cleanDomain(domain) : null;
  if (d && !/^(?=.{4,253}$)([a-z0-9-]{1,63}\.)+[a-z]{2,63}$/.test(d)) throw new HttpError(422, "Enter a domain such as www.yourfirm.com.");
  if (d && d.endsWith(sitesDomain())) throw new HttpError(422, `Subdomains of ${sitesDomain()} are assigned automatically.`);
  if (d) {
    const [clash] = await db.select({ id: s.websiteConfigs.id }).from(s.websiteConfigs).where(and(eq(s.websiteConfigs.customDomain, d), ne(s.websiteConfigs.tenantId, tenantId)));
    if (clash) throw new HttpError(409, `${d} is connected to another site.`);
  }
  await db.update(s.websiteConfigs).set({ customDomain: d, domainVerifiedAt: null, domainCheck: null }).where(eq(s.websiteConfigs.tenantId, tenantId));
}

/** Verifies the TXT record at _nakhla.<domain> and the CNAME to the sites host. Both are required. */
export async function verifyDomain(db: DB, tenantId: string, resolver?: DnsResolver) {
  const cfg = await ensureWebsite(db, tenantId);
  if (!cfg.customDomain) throw new HttpError(409, "Add a custom domain first.");
  const r = resolver ?? (await systemResolver());
  const target = `sites.${sitesDomain()}`;
  let txt = false;
  let cname = false;
  const notes: string[] = [];
  try {
    txt = (await r.txt(`_nakhla.${cfg.customDomain}`)).some((rec) => rec.join("") === cfg.domainToken);
    if (!txt) notes.push(`TXT at _nakhla.${cfg.customDomain} does not contain the verification value yet.`);
  } catch {
    notes.push(`No TXT record found at _nakhla.${cfg.customDomain}.`);
  }
  try {
    cname = (await r.cname(cfg.customDomain)).some((c) => c.replace(/\.$/, "").toLowerCase() === target);
    if (!cname) notes.push(`${cfg.customDomain} does not point to ${target} yet.`);
  } catch {
    notes.push(`No CNAME record found for ${cfg.customDomain}; DNS changes can take up to an hour.`);
  }
  const ok = txt && cname;
  const check = { at: new Date().toISOString(), txt, cname, detail: ok ? "Verified." : notes.join(" ") };
  await db.update(s.websiteConfigs).set({ domainCheck: check, domainVerifiedAt: ok ? new Date() : null }).where(eq(s.websiteConfigs.tenantId, tenantId));
  return check;
}

/* ------------------------------------------------------------ public site */

export async function siteBySlug(db: DB, slugOrHost: string) {
  if (slugOrHost.startsWith("@")) {
    const host = slugOrHost.slice(1).toLowerCase();
    const sub = host.endsWith(`.${sitesDomain()}`) ? host.slice(0, -(sitesDomain().length + 1)) : null;
    const [cfg] = sub ? await db.select().from(s.websiteConfigs).where(eq(s.websiteConfigs.slug, sub)) : await db.select().from(s.websiteConfigs).where(eq(s.websiteConfigs.customDomain, host));
    return cfg && (sub || cfg.domainVerifiedAt) ? cfg : null;
  }
  const [cfg] = await db.select().from(s.websiteConfigs).where(eq(s.websiteConfigs.slug, slugOrHost));
  return cfg ?? null;
}

/** Everything a page render needs. `draft` renders unpublished drafts for the editor preview. */
export async function pageData(db: DB, cfg: typeof s.websiteConfigs.$inferSelect, pageSlug: string, draft = false) {
  const [page] = await db.select().from(s.websitePages).where(and(eq(s.websitePages.tenantId, cfg.tenantId), eq(s.websitePages.slug, pageSlug)));
  if (!page || (!draft && !page.published)) return null;
  const blocks: Block[] = draft ? page.blocks : (await db.select().from(s.websiteBlocks).where(eq(s.websiteBlocks.websitePageId, page.id)).orderBy(asc(s.websiteBlocks.order))).map((b) => ({ type: b.type, content: b.content }));
  const [tenant] = await db.select().from(s.tenants).where(eq(s.tenants.id, cfg.tenantId));
  const nav = await db.select({ slug: s.websitePages.slug, title: s.websitePages.title }).from(s.websitePages).where(and(eq(s.websitePages.tenantId, cfg.tenantId), draft ? undefined : eq(s.websitePages.published, true))).orderBy(asc(s.websitePages.position));
  return { page, blocks, tenant: tenant!, nav };
}

export async function liveListings(db: DB, tenantId: string, purpose: "all" | "sale" | "rent" = "all", limit = 24) {
  return db
    .select({ l: s.listings, agent: s.users.name })
    .from(s.listings)
    .leftJoin(s.users, eq(s.users.id, s.listings.agentUserId))
    .where(and(eq(s.listings.tenantId, tenantId), inArray(s.listings.status, ["active", "under_offer"]), purpose === "all" ? undefined : eq(s.listings.purpose, purpose)))
    .orderBy(desc(s.listings.listedAt))
    .limit(limit);
}

export async function siteAgents(db: DB, tenantId: string) {
  return db.select({ id: s.users.id, name: s.users.name, title: s.users.title, email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, tenantId), inArray(s.users.role, ["tenant_admin", "analyst"]))).orderBy(asc(s.users.createdAt)).limit(12);
}

/** Per-community figures from live listings: count, median asking price per sq ft, sale and rent split. */
export async function areaStats(db: DB, tenantId: string) {
  const rows = await db.select({ community: s.listings.community, city: s.listings.city, price: s.listings.price, area: s.listings.area, purpose: s.listings.purpose, currency: s.listings.currency }).from(s.listings).where(and(eq(s.listings.tenantId, tenantId), inArray(s.listings.status, ["active", "under_offer"])));
  const by = new Map<string, typeof rows>();
  for (const r of rows) by.set(r.community, [...(by.get(r.community) ?? []), r]);
  return [...by.entries()]
    .map(([community, xs]) => {
      const sales = xs.filter((x) => x.purpose === "sale" && x.area > 0).map((x) => x.price / x.area).sort((a, b) => a - b);
      const med = sales.length ? sales[Math.floor(sales.length / 2)]! : null;
      return { community, city: xs[0]!.city, listings: xs.length, forSale: xs.filter((x) => x.purpose === "sale").length, toLet: xs.filter((x) => x.purpose === "rent").length, medianPpsf: med ? formatLocal(Math.round(med), xs[0]!.currency) : null };
    })
    .sort((a, b) => b.listings - a.listings);
}

export async function listingByReference(db: DB, tenantId: string, reference: string) {
  const [r] = await db.select({ l: s.listings, agent: s.users.name, agentEmail: s.users.email }).from(s.listings).leftJoin(s.users, eq(s.users.id, s.listings.agentUserId)).where(and(eq(s.listings.tenantId, tenantId), eq(s.listings.reference, reference.toUpperCase()), inArray(s.listings.status, ["active", "under_offer"])));
  return r ?? null;
}

/* -------------------------------------------------------------------- SEO */

export function siteBase(cfg: { slug: string; customDomain: string | null; domainVerifiedAt: Date | null }) {
  return cfg.customDomain && cfg.domainVerifiedAt ? `https://${cfg.customDomain}` : `https://${cfg.slug}.${sitesDomain()}`;
}

export async function sitemapXml(db: DB, cfg: typeof s.websiteConfigs.$inferSelect) {
  const base = siteBase(cfg);
  const pages = await db.select({ slug: s.websitePages.slug, updatedAt: s.websitePages.updatedAt }).from(s.websitePages).where(and(eq(s.websitePages.tenantId, cfg.tenantId), eq(s.websitePages.published, true)));
  const listings = await liveListings(db, cfg.tenantId, "all", 1000);
  const url = (loc: string, mod: Date) => `  <url><loc>${loc}</loc><lastmod>${mod.toISOString().slice(0, 10)}</lastmod></url>`;
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">', ...pages.map((p) => url(p.slug === "home" ? `${base}/` : `${base}/${p.slug}`, p.updatedAt)), ...listings.map((x) => url(`${base}/listings/${x.l.reference.toLowerCase()}`, x.l.updatedAt)), "</urlset>"].join("\n");
}

export function robotsTxt(cfg: typeof s.websiteConfigs.$inferSelect) {
  return cfg.seo.index ? `User-agent: *\nAllow: /\nSitemap: ${siteBase(cfg)}/sitemap.xml\n` : "User-agent: *\nDisallow: /\n";
}

/** schema.org structured data: the brokerage, and each listing as an offer. */
export function organisationJsonLd(cfg: typeof s.websiteConfigs.$inferSelect, tenantName: string) {
  return { "@context": "https://schema.org", "@type": "RealEstateAgent", name: tenantName, url: siteBase(cfg), email: cfg.contact.email ?? undefined, telephone: cfg.contact.phone ?? undefined, address: cfg.contact.address ?? undefined, description: cfg.seo.description };
}

export function listingJsonLd(cfg: typeof s.websiteConfigs.$inferSelect, l: typeof s.listings.$inferSelect) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: l.title,
    url: `${siteBase(cfg)}/listings/${l.reference.toLowerCase()}`,
    datePosted: l.listedAt?.toISOString(),
    description: l.description.slice(0, 500),
    image: l.photos.slice(0, 5).map((p) => p.url),
    offers: { "@type": "Offer", price: l.price, priceCurrency: l.currency, availability: l.status === "under_offer" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock", businessFunction: l.purpose === "rent" ? "https://purl.org/goodrelations/v1#LeaseOut" : "https://purl.org/goodrelations/v1#Sell" },
    address: { "@type": "PostalAddress", addressLocality: l.city, streetAddress: l.community },
    numberOfRooms: l.bedrooms ?? undefined,
    floorSize: { "@type": "QuantitativeValue", value: l.area, unitCode: l.areaUnit === "sqm" ? "MTK" : "FTK" },
  };
}
