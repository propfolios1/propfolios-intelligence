import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@/db/schema";
import { buildPayload, type ListingContext, normaliseStatus } from "@/lib/portals/payload";
import { PORTAL_SPECS } from "@/lib/portals/specs";
import { testDb } from "./helpers/pglite";

afterEach(() => vi.unstubAllGlobals());

const listing = (o: Partial<ListingContext> = {}): ListingContext => ({ reference: "LS-0001", title: "Two-bedroom apartment, Dubai Marina", description: "A two-bedroom apartment with a marina view, covered parking, gym and pool, offered vacant on transfer.", purpose: "sale", propertyType: "Apartment", price: 2_400_000, currency: "AED", city: "Dubai", community: "Dubai Marina", bedrooms: 2, bathrooms: 3, area: 1280, areaUnit: "sqft", permitNumber: "7120345611", photos: [1, 2, 3, 4, 5].map((i) => ({ url: `https://cdn.example.com/${i}.jpg`, caption: `Photo ${i}` })), agentName: "Reem Al Hashemi", agentEmail: "reem@example.com", agentPhone: "+971501234567", rentPeriod: null, status: "active", listedAt: new Date("2026-09-01"), features: ["Gym"], branchId: "12345", networkId: "678", ...o });

describe("portal field maps", () => {
  it("builds each portal's payload with its own codes", () => {
    const pf = buildPayload(PORTAL_SPECS.propertyfinder!.fieldMap, listing());
    expect(pf.ok && pf.payload).toMatchObject({ reference_number: "LS-0001", offering_type: "RS", property_type: "AP", permit_number: "7120345611", agent: { name: "Reem Al Hashemi" } });
    const bayut = buildPayload(PORTAL_SPECS.bayut!.fieldMap, listing({ purpose: "rent", price: 135_000, rentPeriod: "annual" }));
    expect(bayut.ok && bayut.payload).toMatchObject({ Property_purpose: "Rent", Rent_Frequency: "Yearly", Property_Size_Unit: "SQFT" });
    const acres = buildPayload(PORTAL_SPECS["99acres"]!.fieldMap, listing({ city: "Mumbai", community: "Worli", currency: "INR", price: 86_000_000, permitNumber: "P51900002345" }));
    expect(acres.ok && acres.payload).toMatchObject({ preference: "S", res_com: "R", rera_registration_number: "P51900002345" });
    expect(acres.ok && (acres.payload.photos as { order: number }[])[4]!.order).toBe(5);
    const rm = buildPayload(PORTAL_SPECS.rightmove!.fieldMap, listing({ currency: "GBP", city: "London", community: "Mayfair", permitNumber: null }));
    expect(rm.ok && rm.payload).toMatchObject({ network: { network_id: "678" }, branch: { branch_id: "12345", channel: 1 }, property: { agent_ref: "LS-0001", property_type: 28, address: { town: "London" }, price_information: { price: 2_400_000 } } });
    const zp = buildPayload(PORTAL_SPECS.zoopla!.fieldMap, listing({ purpose: "rent", rentPeriod: "monthly", city: "London", permitNumber: null }));
    expect(zp.ok && zp.payload).toMatchObject({ pricing: { transaction_type: "rent", rent_frequency: "per_month" }, detailed_description: [{ text: expect.stringContaining("marina") }] });
  });
  it("reports the required fields a listing lacks", () => {
    const r = buildPayload(PORTAL_SPECS.bayut!.fieldMap, listing({ permitNumber: null, description: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(["Permit_Number", "Web_Remarks"]);
  });
  it("normalises portal status vocabulary", () => {
    expect(["Published", "pending_review", "REJECTED", "archived", "weird"].map(normaliseStatus)).toEqual(["live", "publishing", "rejected", "removed", null]);
  });
});

/** An in-memory partner API: POST/PUT/DELETE/GET /listings, with switchable failure modes. */
function mockPortal() {
  const store = new Map<string, Record<string, unknown>>();
  const calls: { method: string; url: string; body: unknown; auth: string | null }[] = [];
  let mode: "ok" | "401" | "500" | "429" | "reject" = "ok";
  let n = 0;
  const fetcher = async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? "GET";
    const body = init.body && String(init.body).startsWith("{") ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body, auth: new Headers(init.headers).get("authorization") });
    const json = (b: unknown, status = 200, h: Record<string, string> = {}) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json", ...h } });
    if (mode === "401") return json({ message: "Invalid API key" }, 401);
    if (mode === "500") return json({ message: "Upstream unavailable" }, 500);
    if (mode === "429") return json({ message: "Slow down" }, 429, { "retry-after": "1" });
    const u = new URL(url);
    if (u.pathname.endsWith("/oauth/token")) return json({ access_token: "tok_1", expires_in: 3600 });
    const id = u.pathname.split("/listings/")[1];
    if (method === "POST") {
      const ext = `EXT-${++n}`;
      store.set(ext, { ...body, status: "pending_review" });
      return json({ id: ext, status: "pending_review", url: `https://portal.example.com/p/${ext}` }, 201);
    }
    if (method === "PUT" && id) return store.has(id) ? (store.set(id, { ...body, status: "published" }), json({ id, status: "published" })) : json({ message: "Not found" }, 404);
    if (method === "DELETE" && id) return (store.delete(id), new Response(null, { status: 204 }));
    if (method === "GET" && id) return store.has(id) ? json({ id, status: mode === "reject" ? "rejected" : "published", rejection_reason: mode === "reject" ? "Permit number does not match the Trakheesi record." : null }) : json({ message: "Not found" }, 404);
    if (method === "GET") return json({ data: [] });
    return json({ message: "Unsupported" }, 400);
  };
  return { fetcher, store, calls, setMode: (m: typeof mode) => (mode = m) };
}

describe("publishing pipeline", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let svc: typeof import("@/lib/portals/service");
  let listingId: string;
  beforeAll(async () => {
    env = await testDb();
    svc = await import("@/lib/portals/service");
    const [l] = await env.db
      .insert(s.listings)
      .values({ tenantId: env.a.id, reference: "LS-0001", title: "Two-bedroom apartment, Dubai Marina", market: "AE", city: "Dubai", community: "Dubai Marina", propertyType: "Apartment", purpose: "sale", status: "active", price: 2_400_000, currency: "AED", bedrooms: 2, bathrooms: 3, area: 1280, permitNumber: "7120345611", description: listing().description, photos: listing().photos, agentUserId: env.ua.id })
      .returning();
    listingId = l!.id;
  }, 120_000);

  for (const portal of ["bayut", "propertyfinder", "dubizzle"])
    it(`publishes, updates, polls and removes on ${portal}`, async () => {
      const m = mockPortal();
      vi.stubGlobal("fetch", m.fetcher);
      await svc.connectPortal(env.db, env.a.id, portal, { config: { baseUrl: "https://partner.example.com/v1", accountId: "A1", clientId: "cid" }, secrets: { apiKey: "key_live_123", clientSecret: "sec" } }, { id: env.ua.id, name: "Admin A" });
      const [pub] = await svc.requestPublish(env.db, env.a.id, listingId, [portal], "publish", { id: env.ua.id, name: "Admin A" });
      expect(pub!.status).toBe("publishing");
      const post = m.calls.find((c) => c.method === "POST" && c.url.endsWith("/listings"))!;
      expect(post.auth).toBe(portal === "propertyfinder" ? "Bearer tok_1" : "Bearer key_live_123");
      const poll = await svc.pollPortals(env.db, { now: Date.now() + 7 * 3_600_000 });
      expect(poll.polled).toBeGreaterThanOrEqual(1);
      const [pl] = await env.db.select().from(s.portalListings).where(eq(s.portalListings.portal, portal));
      expect(pl).toMatchObject({ status: "live", externalId: "EXT-1" });
      const [upd] = await svc.requestPublish(env.db, env.a.id, listingId, [portal], "publish", { id: env.ua.id, name: "Admin A" });
      expect(upd!.status).toBe("live");
      expect(m.calls.some((c) => c.method === "PUT" && c.url.endsWith("/listings/EXT-1"))).toBe(true);
      const [del] = await svc.requestPublish(env.db, env.a.id, listingId, [portal], "unpublish", { id: env.ua.id, name: "Admin A" });
      expect(del!.status).toBe("removed");
      expect(m.store.size).toBe(0);
    });

  it("refuses a connection the portal rejects, and stores secrets sealed", async () => {
    const m = mockPortal();
    vi.stubGlobal("fetch", m.fetcher);
    m.setMode("401");
    await expect(svc.connectPortal(env.db, env.a.id, "magicbricks", { config: { baseUrl: "https://partner.example.com" }, secrets: { apiKey: "wrong" } }, { id: null, name: "A" })).rejects.toThrow(/rejected the credentials \(401\)/);
    m.setMode("ok");
    await svc.connectPortal(env.db, env.a.id, "magicbricks", { config: { baseUrl: "https://partner.example.com" }, secrets: { apiKey: "mb_key_secret" } }, { id: null, name: "A" });
    const [c] = await env.db.select().from(s.portalConnections).where(eq(s.portalConnections.portal, "magicbricks"));
    expect(c!.credentialsEncrypted).not.toContain("mb_key_secret");
  });

  it("retries server errors with backoff, fails permanently on rejection, and allows a manual retry", async () => {
    const m = mockPortal();
    vi.stubGlobal("fetch", m.fetcher);
    m.setMode("500");
    const [r] = await svc.requestPublish(env.db, env.a.id, listingId, ["magicbricks"], "publish", { id: null, name: "A" });
    expect(r!.status).toBe("queued");
    const [job] = await env.db.select().from(s.portalPublishJobs).where(eq(s.portalPublishJobs.id, r!.jobId));
    expect(job).toMatchObject({ status: "queued", attempts: 1 });
    expect(job!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 60_000);
    m.setMode("ok");
    await svc.pollPortals(env.db, { now: Date.now() + 3 * 60_000 });
    const [done] = await env.db.select().from(s.portalPublishJobs).where(eq(s.portalPublishJobs.id, r!.jobId));
    expect(done!.status).toBe("succeeded");
    m.setMode("401");
    const [bad] = await svc.requestPublish(env.db, env.a.id, listingId, ["magicbricks"], "publish", { id: null, name: "A" });
    const [failed] = await env.db.select().from(s.portalPublishJobs).where(eq(s.portalPublishJobs.id, bad!.jobId));
    expect(failed!.status).toBe("failed");
    m.setMode("ok");
    const retried = await svc.retryJob(env.db, env.a.id, bad!.jobId);
    expect(retried!.status).toBe("succeeded");
  });

  it("surfaces a rejection found by status polling", async () => {
    const m = mockPortal();
    vi.stubGlobal("fetch", m.fetcher);
    await svc.connectPortal(env.db, env.a.id, "housing", { config: { baseUrl: "https://partner.example.com" }, secrets: { apiKey: "hk" } }, { id: null, name: "A" });
    await svc.requestPublish(env.db, env.a.id, listingId, ["housing"], "publish", { id: null, name: "A" });
    m.setMode("reject");
    await svc.pollPortals(env.db, { now: Date.now() + 20 * 60_000 });
    const [pl] = await env.db.select().from(s.portalListings).where(eq(s.portalListings.portal, "housing"));
    expect(pl).toMatchObject({ status: "rejected", lastError: "Permit number does not match the Trakheesi record." });
  });

  it("defers jobs beyond the portal's rate limit", async () => {
    const m = mockPortal();
    vi.stubGlobal("fetch", m.fetcher);
    await svc.connectPortal(env.db, env.a.id, "99acres", { config: { baseUrl: "https://partner.example.com" }, secrets: { apiKey: "k" } }, { id: null, name: "A" });
    const spec = PORTAL_SPECS["99acres"]!;
    const original = spec.rateLimitPerMinute;
    spec.rateLimitPerMinute = 1;
    try {
      await svc.requestPublish(env.db, env.a.id, listingId, ["99acres"], "publish", { id: null, name: "A" });
      const [second] = await svc.requestPublish(env.db, env.a.id, listingId, ["99acres"], "publish", { id: null, name: "A" }, { defer: true });
      const job = await svc.processJob(env.db, second!.jobId);
      expect(job!.status).toBe("queued");
      expect(job!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 30_000);
    } finally {
      spec.rateLimitPerMinute = original;
    }
  });

  it("sends Rightmove and Zoopla requests in their datafeed formats", async () => {
    const calls: { url: string; body: Record<string, unknown>; type: string | null }[] = [];
    const fetcher = (async (url: string, init: RequestInit = {}) => {
      const body = init.body ? JSON.parse(String(init.body)) : {};
      calls.push({ url, body, type: new Headers(init.headers).get("content-type") });
      if (url.endsWith("sendpropertydetails")) return new Response(JSON.stringify({ success: true, property: { rightmove_id: 987654, rightmove_url: "https://www.rightmove.co.uk/properties/987654" } }), { status: 200, headers: { "content-type": "application/json" } });
      if (url.endsWith("getbranchpropertylist")) return new Response(JSON.stringify({ property: [{ agent_ref: "LS-0001" }] }), { status: 200, headers: { "content-type": "application/json" } });
      if (url.endsWith("/listing/list")) return new Response(JSON.stringify({ listings: [] }), { status: 200, headers: { "content-type": "application/json" } });
      return new Response(JSON.stringify({ status: "OK", listing_reference: body.listing_reference, url: "https://www.zoopla.co.uk/for-sale/details/1" }), { status: 200, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    await svc.connectPortal(env.db, env.a.id, "rightmove", { config: { networkId: "678", branchId: "12345" }, secrets: { certificate: "-----BEGIN CERTIFICATE-----", privateKey: "-----BEGIN PRIVATE KEY-----" } }, { id: null, name: "A" }, { fetcher });
    const [rm] = await svc.requestPublish(env.db, env.a.id, listingId, ["rightmove"], "publish", { id: null, name: "A" }, { fetcher });
    expect(rm!.status).toBe("live");
    const send = calls.find((c) => c.url === "https://adfapi.rightmove.co.uk/v1/property/sendpropertydetails")!;
    expect(send.body).toMatchObject({ branch: { branch_id: "12345", channel: 1 }, property: { agent_ref: "LS-0001" } });
    const [pl] = await env.db.select().from(s.portalListings).where(eq(s.portalListings.portal, "rightmove"));
    expect(pl).toMatchObject({ externalId: "987654", externalUrl: "https://www.rightmove.co.uk/properties/987654" });
    await svc.connectPortal(env.db, env.a.id, "zoopla", { config: { branchId: "ZB-1", sandbox: "true" }, secrets: { certificate: "c", privateKey: "k" } }, { id: null, name: "A" }, { fetcher });
    await svc.requestPublish(env.db, env.a.id, listingId, ["zoopla"], "publish", { id: null, name: "A" }, { fetcher });
    const zp = calls.find((c) => c.url.endsWith("/sandbox/v1/listing/update"))!;
    expect(zp.type).toContain("profile=http://realtime-listings.webservices.zpg.co.uk/docs/v1.2/schemas/listing/update.json");
    expect(zp.body).toMatchObject({ branch_reference: "ZB-1", listing_reference: "LS-0001", pricing: { transaction_type: "sale" } });
  });

  it("keeps connections and publications inside their firm", async () => {
    const other = await env.db.select().from(s.portalConnections).where(eq(s.portalConnections.tenantId, env.b.id));
    expect(other).toHaveLength(0);
    await expect(svc.requestPublish(env.db, env.b.id, listingId, ["bayut"], "publish", { id: null, name: "B" })).rejects.toThrow(/not connected/);
  });
});
