import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { stateForDay } from "@/lib/trial/status";
import { testDb } from "./helpers/pglite";

const DAY = 86_400_000;

describe("trial schedule", () => {
  it("moves from full access to read-only, soft deletion and purge", () => {
    expect([0, 13, 14, 29, 30, 59, 60, 90].map(stateForDay)).toEqual(["active", "active", "read_only", "read_only", "soft_deleted", "soft_deleted", "purged", "purged"]);
  });
});

describe("self-serve trial", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let svc: typeof import("@/lib/trial/service");
  beforeAll(async () => {
    env = await testDb();
    svc = await import("@/lib/trial/service");
  }, 120_000);

  const COUNTRIES: [string, string, string, RegExp][] = [
    ["AE", "AED", "Emaar Properties", /Downtown Dubai|Dubai Marina|Jumeirah Village Circle/],
    ["IN", "INR", "Oberoi Realty", /Bandra West|Andheri West|Powai|Assagao|Anjuna|Panjim/],
    ["GB", "GBP", "Berkeley Group", /Kensington|Chelsea|Mayfair/],
    ["SG", "SGD", "City Developments Limited", /Orchard|Marina Bay/],
    ["AU", "AUD", "Mirvac", /Barangaroo|Bondi|Toorak|Southbank|Mosman/],
    ["US", "USD", "Related Companies", /Tribeca|Hudson Yards|Upper East Side|Brickell|Miami Beach/],
  ];

  for (const [country, currency, developer, communities] of COUNTRIES)
    it(`seeds a ${country} workspace in the market's currency, developers and communities`, async () => {
      const r = await svc.startTrial(env.db, { email: `founder@${country.toLowerCase()}-firm.example.com`, name: "Founder Test", firmName: `${country} Test Realty`, country, agentCount: 8 });
      expect(r.seededInMs).toBeLessThan(60_000);
      const t = r.tenantId;
      const count = async (table: typeof s.leads | typeof s.listings | typeof s.deals | typeof s.clients | typeof s.commissions | typeof s.automations) => (await env.db.select({ id: table.id }).from(table).where(eq(table.tenantId, t))).length;
      expect(await count(s.leads)).toBe(50);
      expect(await count(s.listings)).toBe(30);
      expect(await count(s.deals)).toBe(10);
      expect(await count(s.clients)).toBe(5);
      expect(await count(s.commissions)).toBe(3);
      expect(await count(s.automations)).toBe(2);
      const agents = await env.db.select().from(s.users).where(and(eq(s.users.tenantId, t), eq(s.users.role, "analyst")));
      expect(agents).toHaveLength(3);
      const listings = await env.db.select().from(s.listings).where(eq(s.listings.tenantId, t));
      expect(new Set(listings.map((l) => l.currency))).toEqual(new Set([currency]));
      expect(listings.some((l) => communities.test(l.community))).toBe(true);
      const devs = await env.db.select({ name: s.developers.name }).from(s.developers).where(eq(s.developers.tenantId, t));
      expect(devs.map((d) => d.name)).toContain(developer);
      const md = await env.db.select().from(s.marketData).where(eq(s.marketData.tenantId, t));
      expect(new Set(md.map((m) => m.month)).size).toBe(3);
      // The journey: mandate delivered, deal closed, commission invoiced and paid.
      const [journey] = await env.db.select().from(s.deals).where(and(eq(s.deals.tenantId, t), eq(s.deals.reference, "DL-0001")));
      expect(journey!.status).toBe("won");
      const [inv] = await env.db.select().from(s.invoices).where(eq(s.invoices.dealId, journey!.id));
      expect(inv!.status).toBe("paid");
      const [lc] = await env.db.select().from(s.trialLifecycle).where(eq(s.trialLifecycle.tenantId, t));
      expect(lc!.state).toBe("active");
    }, 120_000);

  it("seeds an unlisted country with the UAE profile", async () => {
    const r = await svc.startTrial(env.db, { email: "founder@elsewhere.example.com", name: "Founder", firmName: "Elsewhere Homes", country: "OTHER", agentCount: 3 });
    const [l] = await env.db.select().from(s.listings).where(eq(s.listings.tenantId, r.tenantId)).limit(1);
    expect(l!.currency).toBe("AED");
  }, 120_000);

  it("blocks a second trial for the same email, in any letter case", async () => {
    await expect(svc.startTrial(env.db, { email: "FOUNDER@ae-firm.example.com", name: "Again", firmName: "Again Realty", country: "AE", agentCount: 2 })).rejects.toThrow("You already have a trial. Log in.");
    await expect(svc.startTrial(env.db, { email: "admin@a.example.com", name: "Existing user", firmName: "X", country: "AE", agentCount: 2 })).rejects.toThrow("You already have a trial. Log in.");
  });

  it("admits three teammates on the trial clock and refuses a fourth", async () => {
    const [signup] = await env.db.select().from(s.trialSignups).where(eq(s.trialSignups.email, "founder@gb-firm.example.com"));
    const actor = { id: (await env.db.select().from(s.users).where(eq(s.users.email, "founder@gb-firm.example.com")))[0]!.id, name: "Founder" };
    const r = await svc.inviteTeammates(env.db, signup!.tenantId!, ["one@gb-firm.example.com", "two@gb-firm.example.com"], actor);
    expect(r.remaining).toBe(1);
    await expect(svc.inviteTeammates(env.db, signup!.tenantId!, ["three@gb-firm.example.com", "four@gb-firm.example.com"], actor)).rejects.toThrow(/up to 3 teammates/);
  });

  it("sends notices once, goes read-only, soft-deletes, restores and purges on schedule", async () => {
    const r = await svc.startTrial(env.db, { email: "clock@example.com", name: "Clock", firmName: "Clock Realty", country: "SG", agentCount: 4 });
    const at = (day: number) => Date.now() + day * DAY + 3_600_000;
    await svc.advanceTrials(env.db, { tenantIds: [r.tenantId], now: at(10) });
    await svc.advanceTrials(env.db, { tenantIds: [r.tenantId], now: at(10) });
    const emails = async () => (await env.db.select().from(s.emailOutbox).where(and(eq(s.emailOutbox.tenantId, r.tenantId), eq(s.emailOutbox.toEmail, "clock@example.com")))).filter((e) => e.subject.startsWith("Clock Realty:")).length;
    expect(await emails()).toBe(1);
    await svc.advanceTrials(env.db, { tenantIds: [r.tenantId], now: at(14) });
    const lc = async () => (await env.db.select().from(s.trialLifecycle).where(eq(s.trialLifecycle.tenantId, r.tenantId)))[0];
    expect((await lc())!.state).toBe("read_only");
    // Day 13 was skipped by the jump from day 10 to day 14: only the day 14 notice goes out.
    expect(await emails()).toBe(2);
    await svc.advanceTrials(env.db, { tenantIds: [r.tenantId], now: at(30) });
    expect((await lc())!.state).toBe("soft_deleted");
    expect((await env.db.select().from(s.tenants).where(eq(s.tenants.id, r.tenantId)))[0]!.status).toBe("suspended");
    await svc.restoreTrial(env.db, r.tenantId, "Nakhla support");
    expect((await lc())!.state).toBe("read_only");
    await svc.advanceTrials(env.db, { tenantIds: [r.tenantId], now: at(61) });
    expect(await env.db.select().from(s.tenants).where(eq(s.tenants.id, r.tenantId))).toHaveLength(0);
    expect(await env.db.select().from(s.leads).where(eq(s.leads.tenantId, r.tenantId))).toHaveLength(0);
    const [signup] = await env.db.select().from(s.trialSignups).where(eq(s.trialSignups.email, "clock@example.com"));
    expect(signup!.tenantId).toBeNull();
  }, 120_000);

  it("converts a trial to paid in place, keeping every record", async () => {
    const [signup] = await env.db.select().from(s.trialSignups).where(eq(s.trialSignups.email, "founder@us-firm.example.com"));
    const t = signup!.tenantId!;
    const before = (await env.db.select({ id: s.leads.id }).from(s.leads).where(eq(s.leads.tenantId, t))).length;
    await svc.convertTrial(env.db, t, "professional", "Founder", "cs_test_123");
    const [tenant] = await env.db.select().from(s.tenants).where(eq(s.tenants.id, t));
    expect(tenant).toMatchObject({ status: "active", plan: "professional" });
    expect((await env.db.select().from(s.trialLifecycle).where(eq(s.trialLifecycle.tenantId, t)))[0]!.state).toBe("converted");
    expect((await env.db.select({ id: s.leads.id }).from(s.leads).where(eq(s.leads.tenantId, t))).length).toBe(before);
    const summary = await svc.advanceTrials(env.db, { tenantIds: [t], now: Date.now() + 90 * DAY });
    expect((await env.db.select().from(s.tenants).where(eq(s.tenants.id, t)))).toHaveLength(1);
    expect(summary).toMatchObject({ checked: 0, purged: 0 });
  }, 120_000);

  it("keeps each trial's records inside its own tenant", async () => {
    const trials = await env.db.select().from(s.trialSignups);
    const ids = trials.map((x) => x.tenantId).filter((x): x is string => Boolean(x));
    for (const id of ids) {
      const leads = await env.db.select({ tenantId: s.leads.tenantId, listingId: s.leads.listingId }).from(s.leads).where(eq(s.leads.tenantId, id));
      const listingIds = new Set((await env.db.select({ id: s.listings.id }).from(s.listings).where(eq(s.listings.tenantId, id))).map((l) => l.id));
      expect(leads.every((l) => !l.listingId || listingIds.has(l.listingId))).toBe(true);
    }
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Stripe", () => {
  it("verifies webhook signatures and rejects tampering or stale events", async () => {
    const { createHmac } = await import("node:crypto");
    const { verifyStripeSignature, planCharge } = await import("@/lib/billing/stripe");
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac("sha256", "whsec_test").update(`${t}.${payload}`).digest("hex");
    expect(verifyStripeSignature(payload, `t=${t},v1=${sig}`, "whsec_test")).toBe(true);
    expect(verifyStripeSignature(payload + " ", `t=${t},v1=${sig}`, "whsec_test")).toBe(false);
    expect(verifyStripeSignature(payload, `t=${t - 3600},v1=${sig}`, "whsec_test")).toBe(false);
    expect(planCharge("professional", "year").net).toBe(Math.round(8_000 * 12 * 0.8));
  });
});
