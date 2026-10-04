import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { BLOCK_TYPES, defaultPages, parseBlock } from "@/lib/website/blocks";
import { THEMES, themeStyle } from "@/lib/website/themes";
import { testDb } from "./helpers/pglite";

describe("themes and blocks", () => {
  it("offers five themes and fills accents from the firm's brand", () => {
    expect(Object.keys(THEMES)).toEqual(["modern", "classic", "luxury", "minimal", "bold"]);
    const st = themeStyle("luxury", { primary: "#13392F", accent: "#B08D57" });
    expect(st).toMatchObject({ "--site-primary": "#13392F", "--site-accent": "#B08D57", "--site-bg": "#0B0D12", "--site-radius": "0px" });
    expect(themeStyle("bold", { primary: "#000", accent: "#fff" })["--site-radius"]).toBe("16px");
  });
  it("validates block content and fills defaults", () => {
    expect(parseBlock({ type: "featured_listings", content: {} }).content).toEqual({ title: "Featured listings", purpose: "all", limit: 6 });
    expect(() => parseBlock({ type: "hero", content: { headline: "" } })).toThrow();
    expect(() => parseBlock({ type: "carousel", content: {} })).toThrow(/Unknown block type/);
    expect(BLOCK_TYPES).toEqual(["hero", "featured_listings", "agent_grid", "testimonials", "contact", "about", "areas", "market_stats"]);
  });
  it("starts every site with home, listings, areas, about and contact pages", () => {
    const pages = defaultPages("Thames Residential", "United Kingdom", "London");
    expect(pages.map((p) => p.slug)).toEqual(["home", "listings", "areas", "about", "contact"]);
    expect(pages[0]!.blocks.map((b) => b.type)).toEqual(["hero", "featured_listings", "market_stats", "agent_grid", "contact"]);
    for (const p of pages) for (const b of p.blocks) expect(() => parseBlock(b)).not.toThrow();
  });
});

describe("website service", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let svc: typeof import("@/lib/website/service");
  beforeAll(async () => {
    env = await testDb();
    svc = await import("@/lib/website/service");
    await env.db.insert(s.listings).values([
      { tenantId: env.a.id, reference: "LS-0001", title: "Two-bedroom apartment, Dubai Marina", market: "AE", city: "Dubai", community: "Dubai Marina", propertyType: "Apartment", purpose: "sale", status: "active", price: 2_400_000, currency: "AED", bedrooms: 2, bathrooms: 3, area: 1200, description: "Marina view.", listedAt: new Date() },
      { tenantId: env.a.id, reference: "LS-0002", title: "Studio to let, JVC", market: "AE", city: "Dubai", community: "Jumeirah Village Circle", propertyType: "Apartment", purpose: "rent", status: "active", price: 58_000, currency: "AED", bedrooms: 0, bathrooms: 1, area: 410, description: "Furnished.", listedAt: new Date() },
      { tenantId: env.a.id, reference: "LS-0003", title: "Villa, sold", market: "AE", city: "Dubai", community: "Dubai Hills Estate", propertyType: "Villa", purpose: "sale", status: "sold", price: 6_850_000, currency: "AED", bedrooms: 4, bathrooms: 5, area: 3140, description: "Sold." },
    ]);
  }, 120_000);

  it("creates a site with a unique slug, then reorders, saves and publishes", async () => {
    const cfg = await svc.ensureWebsite(env.db, env.a.id);
    expect(cfg.slug).toBe("test-a");
    expect((await svc.ensureWebsite(env.db, env.a.id)).id).toBe(cfg.id);
    const { pages } = await svc.getEditorData(env.db, env.a.id);
    const home = pages.find((p) => p.slug === "home")!;
    const moved = svc.reorder(home.blocks, 4, 1);
    expect(moved.map((b) => b.type)).toEqual(["hero", "contact", "featured_listings", "market_stats", "agent_grid"]);
    expect(svc.reorder(home.blocks, 9, 1)).toBe(home.blocks);
    await svc.savePage(env.db, env.a.id, home.id, { blocks: moved });
    expect(await svc.pageData(env.db, cfg, "home")).toBeNull();
    await svc.publishSite(env.db, env.a.id);
    const live = await svc.pageData(env.db, (await svc.ensureWebsite(env.db, env.a.id)), "home");
    expect(live!.blocks.map((b) => b.type)).toEqual(["hero", "contact", "featured_listings", "market_stats", "agent_grid"]);
    // A later draft does not change the live page until the next publish.
    await svc.savePage(env.db, env.a.id, home.id, { blocks: [{ type: "about", content: { title: "Draft", body: "" } }] });
    expect((await svc.pageData(env.db, cfg, "home"))!.blocks).toHaveLength(5);
    expect((await svc.pageData(env.db, cfg, "home", true))!.blocks).toHaveLength(1);
  });

  it("switches themes", async () => {
    await svc.setTheme(env.db, env.a.id, "classic");
    expect((await svc.ensureWebsite(env.db, env.a.id)).theme).toBe("classic");
  });

  it("shows only active listings, live, as their status changes (IDX)", async () => {
    const ids = async () => (await svc.liveListings(env.db, env.a.id)).map((r) => r.l.reference).sort();
    expect(await ids()).toEqual(["LS-0001", "LS-0002"]);
    expect((await svc.liveListings(env.db, env.a.id, "rent")).map((r) => r.l.reference)).toEqual(["LS-0002"]);
    await env.db.update(s.listings).set({ status: "sold" }).where(eq(s.listings.reference, "LS-0002"));
    expect(await ids()).toEqual(["LS-0001"]);
    expect(await svc.listingByReference(env.db, env.a.id, "ls-0002")).toBeNull();
    expect(await svc.listingByReference(env.db, env.b.id, "ls-0001")).toBeNull();
    const areas = await svc.areaStats(env.db, env.a.id);
    expect(areas.map((a) => a.community)).toEqual(["Dubai Marina"]);
  });

  it("produces a sitemap, robots rules and schema.org data", async () => {
    const cfg = await svc.ensureWebsite(env.db, env.a.id);
    const xml = await svc.sitemapXml(env.db, cfg);
    expect(xml).toContain("<loc>https://test-a.nakhla.site/</loc>");
    expect(xml).toContain("https://test-a.nakhla.site/listings/ls-0001");
    expect(xml).not.toContain("ls-0003");
    expect(svc.robotsTxt(cfg)).toContain("Sitemap: https://test-a.nakhla.site/sitemap.xml");
    await svc.setSeo(env.db, env.a.id, { ...cfg.seo, index: false });
    expect(svc.robotsTxt(await svc.ensureWebsite(env.db, env.a.id))).toBe("User-agent: *\nDisallow: /\n");
    const [l] = await env.db.select().from(s.listings).where(eq(s.listings.reference, "LS-0001"));
    const ld = svc.listingJsonLd(cfg, l!);
    expect(ld).toMatchObject({ "@type": "RealEstateListing", offers: { price: 2_400_000, priceCurrency: "AED" }, floorSize: { unitCode: "FTK" } });
  });

  it("verifies a custom domain only when both the TXT and CNAME records are right", async () => {
    await svc.setCustomDomain(env.db, env.a.id, "https://WWW.Firm-A.example.com/");
    const cfg = await svc.ensureWebsite(env.db, env.a.id);
    expect(cfg.customDomain).toBe("www.firm-a.example.com");
    const resolver = (txt: string[][], cname: string[]) => ({ txt: async () => txt, cname: async () => cname });
    const half = await svc.verifyDomain(env.db, env.a.id, resolver([[cfg.domainToken]], ["elsewhere.example.net"]));
    expect(half).toMatchObject({ txt: true, cname: false });
    expect(await svc.siteBySlug(env.db, "@www.firm-a.example.com")).toBeNull();
    const ok = await svc.verifyDomain(env.db, env.a.id, resolver([["v=spf1"], [cfg.domainToken]], ["sites.nakhla.site."]));
    expect(ok).toMatchObject({ txt: true, cname: true, detail: "Verified." });
    expect((await svc.siteBySlug(env.db, "@www.firm-a.example.com"))!.tenantId).toBe(env.a.id);
    expect((await svc.siteBySlug(env.db, "@test-a.nakhla.site"))!.tenantId).toBe(env.a.id);
    await expect(svc.setCustomDomain(env.db, env.b.id, "www.firm-a.example.com")).rejects.toThrow(/connected to another site/);
    await expect(svc.setCustomDomain(env.db, env.b.id, "not a domain")).rejects.toThrow(/Enter a domain/);
  });
});
