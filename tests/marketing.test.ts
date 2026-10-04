import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@/db/schema";
import { fitCaption, validatePost } from "@/lib/marketing/social";
import { testDb } from "./helpers/pglite";

afterEach(() => vi.unstubAllGlobals());

describe("social captions", () => {
  it("fits X to 280 characters with the link kept, and leaves others whole", () => {
    const long = "A".repeat(400);
    const x = fitCaption("x", long, "https://nakhla.site/l/1");
    expect(x.replace(/https?:\/\/\S+/g, "x".repeat(23)).length).toBeLessThanOrEqual(280);
    expect(x.endsWith("https://nakhla.site/l/1")).toBe(true);
    expect(fitCaption("linkedin", "Hello", "https://a.b")).toBe("Hello\n\nhttps://a.b");
    expect(fitCaption("instagram", "Hello", "https://a.b")).toBe("Hello");
  });
  it("requires an image for Instagram and TikTok", () => {
    expect(validatePost(["instagram", "linkedin"], "Caption", [])).toEqual(["Instagram needs at least one image."]);
    expect(validatePost(["linkedin"], "Caption", [])).toEqual([]);
  });
});

describe("marketing automation", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let m: typeof import("@/lib/marketing/service");
  const T0 = new Date("2026-10-01T08:00:00Z");
  const h = (n: number) => new Date(T0.getTime() + n * 3_600_000);
  let leads: (typeof s.leads.$inferSelect)[];
  beforeAll(async () => {
    env = await testDb();
    m = await import("@/lib/marketing/service");
    const base = { tenantId: env.a.id, source: "website", market: "AE", currency: "AED", createdAt: new Date("2026-09-20T00:00:00Z") };
    leads = await env.db
      .insert(s.leads)
      .values([
        { ...base, reference: "LD-1", name: "Sara Ali", email: "sara@example.com", phone: "+971501110001", intent: "buy", consentMarketing: true, budgetMin: 2_000_000, budgetMax: 3_000_000, locations: ["Dubai Marina"] },
        { ...base, reference: "LD-2", name: "Tom Reid", email: "tom@example.com", intent: "buy", consentMarketing: true, budgetMax: 1_000_000 },
        { ...base, reference: "LD-3", name: "No Consent", email: "nc@example.com", intent: "buy", consentMarketing: false, budgetMax: 2_500_000 },
        { ...base, reference: "LD-4", name: "Won Already", email: "won@example.com", intent: "buy", consentMarketing: true, stage: "won", budgetMax: 2_500_000 },
        { ...base, reference: "LD-5", name: "Renter Ray", email: "ray@example.com", intent: "rent", consentMarketing: true, budgetMax: 150_000 },
      ])
      .returning();
  });

  it("audiences always require consent and an open lead", async () => {
    const { audienceCount, audienceMembers } = await import("@/lib/marketing/audience");
    expect((await audienceCount(env.db, env.a.id, {})).n).toBe(3);
    expect((await audienceMembers(env.db, env.a.id, { intents: ["buy"], budgetMin: 2_000_000 })).map((x) => x.name)).toEqual(["Sara Ali"]);
    expect((await audienceMembers(env.db, env.a.id, { locations: ["dubai marina"] })).map((x) => x.name)).toEqual(["Sara Ali"]);
    expect((await audienceCount(env.db, env.b.id, {})).n).toBe(0);
  });

  it("validates steps: emails need substance, WhatsApp needs an approved template", async () => {
    await expect(m.createCampaign(env.db, env.a.id, { name: "x", kind: "sequence", steps: [{ channel: "email", delayHours: 0, subject: "", body: "short" }], userId: env.ua.id })).rejects.toThrow(/subject and a body/);
    await expect(m.createCampaign(env.db, env.a.id, { name: "x", kind: "sequence", steps: [{ channel: "whatsapp", delayHours: 0, body: "" }], userId: env.ua.id })).rejects.toThrow(/approved template/);
  });

  it("runs a sequence step by step, with merge fields, delays and the stop-on-reply rule", async () => {
    const c = await m.createCampaign(env.db, env.a.id, {
      name: "Buyer nurture",
      kind: "sequence",
      audienceFilter: { intents: ["buy"] },
      steps: [
        { channel: "email", delayHours: 0, subject: "{first_name}, three homes in your range", body: "Good afternoon {first_name}, {agent_name} has shortlisted three homes in your budget this week." },
        { channel: "email", delayHours: 48, subject: "Following up, {first_name}", body: "Good afternoon {first_name}, a short follow-up on the shortlist {agent_name} sent on Monday." },
      ],
      userId: env.ua.id,
    });
    const { enrolled } = await m.activate(env.db, env.a.id, c.id, T0);
    expect(enrolled).toBe(2);
    expect(await m.dispatchDue(env.db, { now: h(0), tenantIds: [env.a.id] })).toMatchObject({ sent: 2 });
    const mails = await env.db.select().from(s.emailOutbox).where(eq(s.emailOutbox.toEmail, "sara@example.com"));
    expect(mails[0]!.subject).toBe("Sara, three homes in your range");
    expect(mails[0]!.bodyText).toContain("Reply UNSUBSCRIBE");
    // Tom replies before step two is due; Sara does not.
    await env.db.insert(s.leadActivities).values({ tenantId: env.a.id, leadId: leads[1]!.id, type: "inbound", summary: "Replied by email", occurredAt: h(5) });
    expect(await m.dispatchDue(env.db, { now: h(47), tenantIds: [env.a.id] })).toMatchObject({ sent: 0, skipped: 0 });
    expect(await m.dispatchDue(env.db, { now: h(49), tenantIds: [env.a.id] })).toMatchObject({ sent: 1, skipped: 1 });
    const stats = await m.campaignStats(env.db, env.a.id, c.id);
    expect(stats.steps.map((st) => st.counts)).toEqual([{ sent: 2 }, { sent: 1, skipped: 1 }]);
    expect(stats.reasons).toEqual([{ reason: "Replied; sequence stopped", n: 1 }]);
  });

  it("enrols only leads created after a lead-triggered sequence was switched on", async () => {
    const c = await m.createCampaign(env.db, env.a.id, { name: "New renters", kind: "sequence", trigger: "lead_created", audienceFilter: { intents: ["rent"] }, steps: [{ channel: "email", delayHours: 1, subject: "Rentals this week", body: "Good afternoon {first_name}, here are the rentals that match what you told us." }], userId: env.ua.id });
    expect((await m.activate(env.db, env.a.id, c.id, T0)).enrolled).toBe(0);
    await env.db.insert(s.leads).values({ tenantId: env.a.id, reference: "LD-6", name: "New Renter", email: "nr@example.com", source: "website", market: "AE", currency: "AED", intent: "rent", consentMarketing: true, createdAt: h(2) });
    expect(await m.enrollNewLeads(env.db, { now: h(3), tenantIds: [env.a.id] })).toBe(1);
    expect(await m.enrollNewLeads(env.db, { now: h(4), tenantIds: [env.a.id] })).toBe(0);
  });

  it("promotes a new listing to matching buyers and on social, and again only after a real price cut", async () => {
    await m.connectSocial(env.db, env.a.id, { network: "linkedin", mode: "sandbox", displayName: "Test Brokerage A" });
    const rule = await m.createCampaign(env.db, env.a.id, { name: "Auto-promote", kind: "auto_promote", networks: ["linkedin"], steps: [{ channel: "email", delayHours: 0, subject: "New: {listing_title}", body: "Good afternoon {first_name}, {listing_title} in {community} has just come to market at {listing_price}." }], userId: env.ua.id });
    await m.activate(env.db, env.a.id, rule.id, T0);
    const [l] = await env.db.insert(s.listings).values({ tenantId: env.a.id, reference: "NK-1", title: "Two-bedroom apartment, Marina Gate", market: "AE", city: "Dubai", community: "Dubai Marina", propertyType: "Apartment", purpose: "sale", status: "active", price: 2_500_000, currency: "AED", area: 1_250, areaUnit: "sqft", bedrooms: 2, bathrooms: 2, listedAt: h(1) } as typeof s.listings.$inferInsert).returning();
    expect(await m.autoPromote(env.db, { now: h(2), tenantIds: [env.a.id] })).toBe(1);
    expect(await m.autoPromote(env.db, { now: h(3), tenantIds: [env.a.id] })).toBe(0);
    await m.dispatchDue(env.db, { now: h(3), tenantIds: [env.a.id] });
    const promo = await env.db.select().from(s.emailOutbox).where(eq(s.emailOutbox.subject, "New: Two-bedroom apartment, Marina Gate"));
    expect(promo.map((x) => x.toEmail)).toEqual(["sara@example.com"]);
    expect(promo[0]!.bodyText).toContain("at AED 2,500,000");
    expect(await m.publishDueSocial(env.db, { now: h(3), tenantIds: [env.a.id] })).toBe(1);
    const [post] = await env.db.select().from(s.socialPosts).where(eq(s.socialPosts.listingId, l!.id));
    expect(post!.status).toBe("published");
    await env.db.update(s.listings).set({ price: 2_475_000 }).where(eq(s.listings.id, l!.id));
    expect(await m.autoPromote(env.db, { now: h(4), tenantIds: [env.a.id] })).toBe(0);
    await env.db.update(s.listings).set({ price: 2_350_000 }).where(eq(s.listings.id, l!.id));
    expect(await m.autoPromote(env.db, { now: h(5), tenantIds: [env.a.id] })).toBe(1);
    const children = await env.db.select().from(s.campaigns).where(and(eq(s.campaigns.listingId, l!.id), eq(s.campaigns.kind, "one_off")));
    expect(children.map((x) => x.name).sort()).toEqual(["New listing: Two-bedroom apartment, Marina Gate", "Price reduced: Two-bedroom apartment, Marina Gate"]);
  });

  it("publishes live to X through its API and records failures per network", async () => {
    await m.connectSocial(env.db, env.a.id, { network: "x", mode: "live", displayName: "@testbrokerage", creds: { accessToken: "user-token" } });
    await m.connectSocial(env.db, env.a.id, { network: "facebook", mode: "live", displayName: "Test Brokerage A", creds: { accessToken: "page-token", pageId: "123" } });
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push(url);
      if (url.includes("api.x.com")) {
        expect(new Headers(init.headers).get("authorization")).toBe("Bearer user-token");
        // X counts every link as 23 characters.
        expect(JSON.parse(String(init.body)).text.replace(/https?:\/\/\S+/g, "x".repeat(23)).length).toBeLessThanOrEqual(280);
        return new Response(JSON.stringify({ data: { id: "1801" } }), { status: 201, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: { message: "Invalid OAuth access token." } }), { status: 401, headers: { "content-type": "application/json" } });
    });
    const p = await m.schedulePost(env.db, env.a.id, { networks: ["x", "facebook"], caption: "Open house this Saturday at Marina Gate, 11:00 to 14:00. ".repeat(6), link: "https://example.com/open-house", mediaUrls: [], scheduledAt: h(10), userId: env.ua.id });
    // This post, and the price-reduction post the previous test scheduled.
    expect(await m.publishDueSocial(env.db, { now: h(10), tenantIds: [env.a.id] })).toBe(2);
    const [row] = await env.db.select().from(s.socialPosts).where(eq(s.socialPosts.id, p.id));
    expect(row!.status).toBe("partial");
    expect(row!.results.x).toMatchObject({ status: "published", url: "https://x.com/i/web/status/1801" });
    expect(row!.results.facebook?.error).toContain("rejected the credentials");
    await expect(m.schedulePost(env.db, env.a.id, { networks: ["tiktok"], caption: "x", mediaUrls: ["https://cdn.example.com/a.jpg"], scheduledAt: h(11), userId: env.ua.id })).rejects.toThrow(/Connect tiktok/);
  });
});
