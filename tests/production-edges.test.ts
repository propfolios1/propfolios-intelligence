import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { nextDue, periodKey, windowDays } from "@/lib/market-intel/brief";
import { convertAed, CURRENCIES, FALLBACK_RATES, formatPrice } from "@/lib/fx";
import { testDb } from "./helpers/pglite";

afterEach(() => vi.unstubAllEnvs());

describe("brief scheduling at period boundaries", () => {
  it("rolls monthly briefs into the new year and keeps fortnightly ones on Mondays", () => {
    expect(nextDue("monthly", new Date("2026-12-15T09:00:00Z")).toISOString()).toBe("2027-01-04T06:00:00.000Z");
    const f = nextDue("fortnightly", new Date("2026-12-28T07:00:00Z"));
    expect(f.getUTCDay()).toBe(1);
    expect(f.toISOString()).toBe("2027-01-11T06:00:00.000Z");
    expect([windowDays("weekly"), windowDays("fortnightly"), windowDays("monthly")]).toEqual([7, 14, 31]);
    // Two subscriptions in the same week never share a period key.
    expect(periodKey("weekly", new Date("2026-10-05T06:00:00Z"), "aaaaaaaa-1")).not.toBe(periodKey("weekly", new Date("2026-10-05T06:00:00Z"), "bbbbbbbb-1"));
  });
});

describe("display currencies", () => {
  it("formats every currency without fractions and keeps AED exact", () => {
    for (const c of CURRENCIES) expect(formatPrice(convertAed(25_000, c, FALLBACK_RATES), c)).not.toMatch(/\.\d/);
    expect(convertAed(25_000, "AED", FALLBACK_RATES)).toBe(25_000);
    expect(formatPrice(convertAed(1_500, "INR", FALLBACK_RATES), "INR")).toMatch(/^₹\d{2},\d{3}$/);
  });
});

describe("enterprise edges", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => {
    env = await testDb();
  }, 120_000);

  it("refuses webhook endpoints on internal host names", async () => {
    const w = await import("@/lib/webhooks/service");
    for (const url of ["https://localhost/hook", "https://db.internal/hook", "https://printer.local/hook", "https://192.168.1.10/hook", "https://169.254.169.254/latest"]) await expect(w.createEndpoint(env.db, env.a.id, { url, events: ["deal.closed"] }, null)).rejects.toThrow(/public internet/);
    const { endpoint } = await w.createEndpoint(env.db, env.a.id, { url: "https://hooks.example.com/a", events: ["deal.closed"] }, null);
    await expect(w.updateEndpoint(env.db, env.a.id, endpoint.id, { events: [] })).rejects.toThrow(/at least one event/);
    await expect(w.updateEndpoint(env.db, env.b.id, endpoint.id, { active: false })).rejects.toThrow(/not found/);
  });

  it("limits audit exports to 400 days and filters by record type", async () => {
    const ax = await import("@/lib/enterprise/audit-export");
    await expect(ax.previewExport(env.db, env.a.id, { from: new Date("2025-01-01"), to: new Date("2026-06-01") })).rejects.toThrow(/400 days/);
    const { db, a } = env;
    const s = await import("@/db/schema");
    await db.insert(s.auditLogs).values([
      { tenantId: a.id, actorName: "A", actorType: "user", action: "x", entityType: "lead", createdAt: new Date("2026-09-02T00:00:00Z") },
      { tenantId: a.id, actorName: "A", actorType: "user", action: "y", entityType: "deal", createdAt: new Date("2026-09-02T00:00:00Z") },
    ]);
    const p = await ax.previewExport(db, a.id, { from: new Date("2026-09-01"), to: new Date("2026-09-30"), entityType: "deal" });
    expect(p.rows).toBe(1);
    expect(p.entityTypes).toEqual(expect.arrayContaining(["deal", "lead"]));
  });

  it("states an undeclared region honestly and resolves known ones", async () => {
    vi.stubEnv("NAKHLA_DATA_REGION", "");
    const r = await import("@/lib/enterprise/residency");
    expect(r.deploymentRegion()).toBeNull();
    expect(r.subprocessors()[0]!.location).toBe("The Supabase project's region");
    vi.stubEnv("NAKHLA_DATA_REGION", "ap-south-1");
    expect(r.deploymentRegion()).toMatchObject({ label: "Mumbai", location: "India" });
    expect(r.regionByKey("uae-dedicated")!.available).toBe(false);
  });
});

describe("money in summaries", () => {
  it("reads in billions above a thousand million, and in crore for rupees", async () => {
    const { formatLocal } = await import("@/lib/domain");
    expect(formatLocal(1_056_950_000, "AED")).toBe("AED 1.06B");
    expect(formatLocal(24_500_000, "AED")).toBe("AED 24.50M");
    expect(formatLocal(52_000_000, "INR")).toBe("INR 5.20 Cr");
  });
});
