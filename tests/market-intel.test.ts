import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import type { SubscriptionFilters } from "@/db/schema-production";
import { composeBrief, isoWeek, matches, median, nextDue, periodKey, regionsFor } from "@/lib/market-intel/brief";
import { subscriptionBody } from "@/lib/market-intel/schemas";
import { testDb } from "./helpers/pglite";

const F: SubscriptionFilters = { markets: ["AE"], areas: ["Dubai Marina"], propertyTypes: [], bedrooms: [2], budgetMin: 1_000_000, budgetMax: 3_000_000, currency: "AED", purpose: "sale" };

describe("brief scheduling", () => {
  it("schedules briefs for Monday 06:00 UTC by frequency", () => {
    const wed = new Date("2026-10-07T12:00:00Z");
    expect(nextDue("weekly", wed).toISOString()).toBe("2026-10-12T06:00:00.000Z");
    expect(nextDue("fortnightly", wed).toISOString()).toBe("2026-10-19T06:00:00.000Z");
    expect(nextDue("monthly", wed).toISOString()).toBe("2026-11-02T06:00:00.000Z");
    // A Monday run schedules the following Monday, never the same day.
    expect(nextDue("weekly", new Date("2026-10-12T06:00:00Z")).toISOString()).toBe("2026-10-19T06:00:00.000Z");
  });
  it("keys periods by ISO week or month and subscription", () => {
    expect(isoWeek(new Date("2026-01-01T00:00:00Z"))).toBe("2026-W01");
    expect(isoWeek(new Date("2027-01-01T00:00:00Z"))).toBe("2026-W53");
    expect(periodKey("monthly", new Date("2026-10-04T00:00:00Z"), "abcdef12-3456")).toBe("2026-10#abcdef12");
    expect(median([3, 1, 2, 10])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("brief composition", () => {
  it("matches listings and units by market, area, bedrooms, budget and purpose", () => {
    const base = { market: "AE", community: "Dubai Marina", city: "Dubai", propertyType: "Apartment", bedrooms: 2, price: 2_000_000, purpose: "sale" };
    expect(matches(F, base)).toBe(true);
    expect(matches(F, { ...base, community: "JVC" })).toBe(false);
    expect(matches(F, { ...base, bedrooms: 3 })).toBe(false);
    expect(matches(F, { ...base, price: 3_500_000 })).toBe(false);
    expect(matches(F, { ...base, purpose: "rent" })).toBe(false);
    expect(matches({ ...F, bedrooms: [5] }, { ...base, bedrooms: 7 })).toBe(true);
    // Developer units carry no community: area filters do not exclude them.
    expect(matches(F, { market: "AE", bedrooms: 2, price: 1_800_000 })).toBe(true);
    expect(regionsFor(F, [{ city: "Dubai", community: "Dubai Marina" }])).toEqual(["Dubai"]);
    expect(regionsFor({ ...F, areas: [] })).toEqual(["Dubai", "Abu Dhabi", "Sharjah"]);
  });

  it("computes market signals, new listings and developer price cuts from the data alone", () => {
    const now = new Date("2026-10-05T06:00:00Z");
    const since = new Date("2026-09-28T06:00:00Z");
    const market = Array.from({ length: 13 }, (_, i) => {
      const m = new Date(Date.UTC(2025, 8 + i, 1)).toISOString().slice(0, 10);
      return { region: "Dubai", month: m, transactions: 3000, medianPriceSqft: 1600 * (1 + i * 0.01), rentalYield: 6.4, absorptionRate: 0.9, supplyUnits: 1000 };
    });
    const L = (ref: string, price: number, listedAt: Date, extra: Partial<{ community: string; bedrooms: number }> = {}) => ({ id: ref, reference: ref, title: `Apartment ${ref}`, market: "AE", city: "Dubai", community: extra.community ?? "Dubai Marina", propertyType: "Apartment", purpose: "sale" as const, bedrooms: extra.bedrooms ?? 2, price, currency: "AED", area: 1200, areaUnit: "sqft" as const, listedAt });
    const out = composeBrief({
      clientName: "Omar",
      subscription: { id: "sub-1", name: "Marina twos", filters: F, frequency: "weekly", includeInventory: true },
      now,
      since,
      market,
      listings: [L("A", 2_000_000, new Date("2026-08-01")), L("B", 2_400_000, new Date("2026-10-01")), L("C", 2_200_000, new Date("2026-10-02"), { community: "JVC" }), L("D", 2_100_000, new Date("2026-10-03"), { bedrooms: 3 })],
      inventory: [
        { developer: "Emaar Properties", market: "AE", project: "Marina Vista", unitRef: "MV-1201", bedrooms: 2, price: 2_700_000, previousPrice: 2_900_000, currency: "AED", status: "available", firstSeenAt: new Date("2026-06-01"), priceChangedAt: new Date("2026-10-01"), statusChangedAt: null },
        { developer: "Emaar Properties", market: "AE", project: "Marina Vista", unitRef: "MV-1502", bedrooms: 2, price: 2_500_000, previousPrice: null, currency: "AED", status: "available", firstSeenAt: new Date("2026-10-02"), priceChangedAt: null, statusChangedAt: null },
        { developer: "Emaar Properties", market: "AE", project: "Marina Vista", unitRef: "MV-3001", bedrooms: 2, price: 9_000_000, previousPrice: 9_500_000, currency: "AED", status: "available", firstSeenAt: new Date("2026-06-01"), priceChangedAt: new Date("2026-10-01"), statusChangedAt: null },
      ],
    });
    expect(out.title).toBe("Marina twos: market brief, week of 5 October 2026");
    expect(out.brief.listings.map((l) => [l.reference, l.isNew])).toEqual([["B", true], ["A", false]]);
    expect(out.brief.areaStats).toEqual([{ area: "Dubai Marina", market: "AE", listings: 2, medianPrice: 2_200_000, medianPpsf: 1833, changePct: 20 }]);
    expect(out.brief.inventory.map((u) => [u.unitRef, u.change])).toEqual([["MV-1201", "price_cut"], ["MV-1502", "new"]]);
    expect(out.brief.series).toHaveLength(12);
    const text = out.brief.signals.map((x) => x.text).join(" ");
    expect(text).toMatch(/Dubai prices are 12\.0% higher than a year ago/);
    expect(text).toMatch(/absorption is 90%/);
    expect(text).toMatch(/1 home matching your criteria was listed/);
    expect(text).toMatch(/MV-1201, 6\.9% to AED 2\.7M/);
    expect(out.content.metrics[0]).toEqual({ label: "Matching listings", value: "2" });
  });

  it("reads absorption stored as a percentage or a fraction", () => {
    const row = (absorptionRate: number) => ({ region: "Dubai", month: "2026-09-01", transactions: 100, medianPriceSqft: 1700, rentalYield: 6, absorptionRate, supplyUnits: 10 });
    const run = (a: number) => composeBrief({ clientName: "X", subscription: { id: "s", name: "D", filters: F, frequency: "weekly", includeInventory: false }, now: new Date("2026-10-05T06:00:00Z"), since: new Date("2026-09-28T06:00:00Z"), market: [row(a)], listings: [], inventory: [] }).brief.signals.map((x) => x.text).join(" ");
    expect(run(91)).toMatch(/absorption is 91%/);
    expect(run(0.91)).toMatch(/absorption is 91%/);
    expect(run(62)).not.toMatch(/absorption/);
  });

  it("says plainly when the firm holds no data for a market", () => {
    const out = composeBrief({ clientName: "Priya", subscription: { id: "s", name: "Worli", filters: { ...F, markets: ["IN"], areas: ["Worli"], currency: "INR" }, frequency: "monthly", includeInventory: false }, now: new Date("2026-10-05T06:00:00Z"), since: new Date("2026-09-05T06:00:00Z"), market: [], listings: [], inventory: [] });
    expect(out.title).toBe("Worli: market brief, October 2026");
    expect(out.content.sections[0]!.body).toMatch(/does not hold monthly transaction statistics for India/);
    expect(out.content.headline).toMatch(/No homes in the firm's current inventory match/);
    expect(out.content.sections.map((x) => x.heading)).not.toContain("Developer inventory");
  });

  it("validates subscription requests", () => {
    expect(subscriptionBody.safeParse({ name: "Marina", filters: F, frequency: "weekly", channels: ["portal"], includeInventory: true }).success).toBe(true);
    expect(subscriptionBody.safeParse({ name: "Marina", filters: F, frequency: "daily", channels: ["portal"], includeInventory: true }).success).toBe(false);
    expect(subscriptionBody.safeParse({ name: "Marina", filters: F, frequency: "weekly", channels: [], includeInventory: true }).success).toBe(false);
  });
});

describe("subscriptions and delivery", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let svc: typeof import("@/lib/market-intel/service");
  let clientId: string;
  beforeAll(async () => {
    env = await testDb();
    svc = await import("@/lib/market-intel/service");
    const [c] = await env.db.insert(s.clients).values({ tenantId: env.a.id, name: "Omar Saleh", type: "HNWI", nationality: "Emirati", residency: "UAE resident", domicile: "UAE", aumAed: 10_000_000, riskProfile: "Balanced", policy: {} as never }).returning();
    clientId = c!.id;
    await env.db.insert(s.users).values({ tenantId: env.a.id, name: "Omar Saleh", email: "omar@client.example.com", role: "client", clientId });
    await env.db.insert(s.listings).values([
      { tenantId: env.a.id, reference: "NK-1", title: "Two-bedroom apartment, Marina Gate", market: "AE", city: "Dubai", community: "Dubai Marina", propertyType: "Apartment", purpose: "sale", status: "active", price: 2_500_000, currency: "AED", area: 1_250, areaUnit: "sqft", bedrooms: 2, bathrooms: 2, listedAt: new Date("2026-10-06T08:00:00Z") },
      { tenantId: env.b.id, reference: "NK-1", title: "Other firm's apartment", market: "AE", city: "Dubai", community: "Dubai Marina", propertyType: "Apartment", purpose: "sale", status: "active", price: 2_400_000, currency: "AED", area: 1_250, areaUnit: "sqft", bedrooms: 2, bathrooms: 2, listedAt: new Date("2026-10-06T08:00:00Z") },
    ] as (typeof s.listings.$inferInsert)[]);
  });

  it("delivers due briefs to the portal and by email, then schedules the next one", async () => {
    const sub = await svc.createSubscription(env.db, env.a.id, clientId, { name: "Marina twos", filters: F, frequency: "weekly", channels: ["portal", "email"], includeInventory: true }, { now: new Date("2026-10-07T12:00:00Z") });
    expect(sub.nextDueAt.toISOString()).toBe("2026-10-12T06:00:00.000Z");
    expect(await svc.runMarketBriefs(env.db, { now: new Date("2026-10-11T06:00:00Z"), tenantIds: [env.a.id] })).toMatchObject({ due: 0 });
    expect(await svc.runMarketBriefs(env.db, { now: new Date("2026-10-12T06:20:00Z"), tenantIds: [env.a.id] })).toMatchObject({ due: 1, sent: 1 });
    const reports = await svc.clientReportList(env.db, env.a.id, clientId);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.brief!.listings.map((l) => l.title)).toEqual(["Two-bedroom apartment, Marina Gate"]);
    expect(reports[0]!.deliveredAt).not.toBeNull();
    const notes = await env.db.select().from(s.notifications).where(eq(s.notifications.tenantId, env.a.id));
    expect(notes.some((n) => n.href === `/client/reports/${reports[0]!.id}`)).toBe(true);
    const mail = await env.db.select().from(s.emailOutbox).where(eq(s.emailOutbox.toEmail, "omar@client.example.com"));
    expect(mail[0]!.subject).toMatch(/^Marina twos: market brief/);
    const [after] = await svc.listSubscriptions(env.db, env.a.id, clientId);
    expect(after!.nextDueAt.toISOString()).toBe("2026-10-19T06:00:00.000Z");
    // A second run in the same week refreshes the brief rather than adding one.
    await svc.generateBrief(env.db, after!, { now: new Date("2026-10-13T06:00:00Z"), deliver: false });
    expect(await svc.clientReportList(env.db, env.a.id, clientId)).toHaveLength(1);
  });

  it("keeps subscriptions to their client and firm, and enforces limits", async () => {
    const [sub] = await svc.listSubscriptions(env.db, env.a.id, clientId);
    await expect(svc.updateSubscription(env.db, env.b.id, clientId, sub!.id, { active: false })).rejects.toThrow(/not found/);
    expect(await svc.clientReport(env.db, env.b.id, clientId, (await svc.clientReportList(env.db, env.a.id, clientId))[0]!.id)).toBeNull();
    await expect(svc.createSubscription(env.db, env.a.id, clientId, { name: "Bad", filters: { ...F, budgetMin: 5, budgetMax: 1 }, frequency: "weekly", channels: ["portal"], includeInventory: false })).rejects.toThrow(/minimum budget/);
    const paused = await svc.updateSubscription(env.db, env.a.id, clientId, sub!.id, { active: false });
    expect(await svc.runMarketBriefs(env.db, { now: new Date("2026-12-01T00:00:00Z"), tenantIds: [env.a.id] })).toMatchObject({ due: 0 });
    expect(paused.active).toBe(false);
    for (let i = 0; i < svc.MAX_SUBSCRIPTIONS - 1; i++) await svc.createSubscription(env.db, env.a.id, clientId, { name: `Brief ${i}`, filters: F, frequency: "monthly", channels: ["portal"], includeInventory: false });
    await expect(svc.createSubscription(env.db, env.a.id, clientId, { name: "One too many", filters: F, frequency: "monthly", channels: ["portal"], includeInventory: false })).rejects.toThrow(/up to 6/);
    await svc.deleteSubscription(env.db, env.a.id, clientId, sub!.id);
    expect(await svc.listSubscriptions(env.db, env.a.id, clientId)).toHaveLength(svc.MAX_SUBSCRIPTIONS - 1);
  });
});
