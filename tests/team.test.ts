import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import type { AgentMetricSet } from "@/db/schema-production";
import { coachingFlags, leaderboard, median, medians, totals } from "@/lib/team/coaching";
import { testDb } from "./helpers/pglite";

const base: AgentMetricSet = { leadsAssigned: 20, leadsContacted: 18, leadsWon: 4, leadsLost: 6, conversionPct: 40, medianResponseHours: 1, activities: 60, calls: 30, messages: 20, viewings: 10, listingsTaken: 3, activeListings: 5, avgDaysOnMarket: 40, dealsClosed: 2, dealValue: 4_000_000, gci: 80_000, pipelineValue: 2_000_000, overdueFollowUps: 1, staleLeads: 1 };

describe("coaching rules", () => {
  it("computes medians and totals, ignoring missing values", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([null, null])).toBeNull();
    const t = totals([base, { ...base, leadsWon: 6, leadsLost: 4, gci: 20_000.55 }]);
    expect(t.conversionPct).toBe(50);
    expect(t.gci).toBe(100_000.55);
  });
  it("ranks with ties and drops people with nothing to rank", () => {
    const rows = [
      { userId: "a", name: "Aisha", m: { ...base, gci: 100 } },
      { userId: "b", name: "Bilal", m: { ...base, gci: 300 } },
      { userId: "c", name: "Chen", m: { ...base, gci: 100 } },
      { userId: "d", name: "Dana", m: { ...base, gci: 0 } },
    ];
    expect(leaderboard(rows, "gci").map((r) => [r.name, r.rank])).toEqual([
      ["Bilal", 1],
      ["Aisha", 2],
      ["Chen", 2],
    ]);
    expect(leaderboard(rows.map((r, i) => ({ ...r, m: { ...r.m, medianResponseHours: [5, 0.5, 2, null][i] ?? null } })), "medianResponseHours", "lower")[0]!.name).toBe("Bilal");
  });
  it("flags slow response, low conversion, overdue follow-ups and cold leads only with enough volume", () => {
    const med = medians([base, base, base]);
    const slow = coachingFlags({ ...base, medianResponseHours: 30 }, med).map((f) => [f.key, f.severity]);
    expect(slow).toContainEqual(["slow_response", "high"]);
    expect(coachingFlags({ ...base, conversionPct: 10, leadsWon: 1, leadsLost: 9 }, med).map((f) => f.key)).toContain("low_conversion");
    expect(coachingFlags({ ...base, conversionPct: 0, leadsWon: 0, leadsLost: 2 }, med).map((f) => f.key)).not.toContain("low_conversion");
    expect(coachingFlags({ ...base, overdueFollowUps: 16 }, med).find((f) => f.key === "overdue_followups")?.severity).toBe("high");
    expect(coachingFlags({ ...base, staleLeads: 6, leadsAssigned: 15, leadsWon: 0, leadsLost: 0 }, med).map((f) => f.key)).toContain("stale_pipeline");
    expect(coachingFlags(base, med).filter((f) => f.kind === "concern")).toEqual([]);
  });
  it("recognises strong performers and judges target pace from the elapsed quarter", () => {
    const med = medians([base, base, base]);
    const star = coachingFlags({ ...base, gci: 200_000, dealsClosed: 4, conversionPct: 70, leadsWon: 7, leadsLost: 3 }, med).map((f) => f.key);
    expect(star).toEqual(expect.arrayContaining(["top_producer", "top_conversion"]));
    expect(coachingFlags(base, med, { target: { gci: 500_000, dealsClosed: null }, periodElapsed: 0.5 }).find((f) => f.key === "target_risk")?.severity).toBe("high");
    expect(coachingFlags(base, med, { target: { gci: 400_000, dealsClosed: null }, periodElapsed: 0.5 }).find((f) => f.key === "target_risk")?.severity).toBe("medium");
    expect(coachingFlags(base, med, { target: { gci: 400_000, dealsClosed: null }, periodElapsed: 0.2 }).map((f) => f.key)).not.toContain("target_risk");
    expect(coachingFlags(base, med, { target: { gci: 100_000, dealsClosed: null }, periodElapsed: 0.5 }).map((f) => f.key)).toContain("ahead_of_target");
  });
});

describe("team metrics from records", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let t: typeof import("@/lib/team/metrics");
  let agent: string;
  const now = new Date("2026-10-20T12:00:00Z");
  beforeAll(async () => {
    env = await testDb();
    t = await import("@/lib/team/metrics");
    const [u] = await env.db.insert(s.users).values({ tenantId: env.a.id, name: "Rohan Mehta", email: "rohan@a.example.com", role: "analyst" }).returning();
    agent = u!.id;
    const mk = (i: number, extra: Partial<typeof s.leads.$inferInsert>) => ({ tenantId: env.a.id, reference: `LD-${i}`, name: `Lead ${i}`, source: "website", market: "AE", intent: "buy" as const, currency: "AED", ownerUserId: agent, createdAt: new Date(`2026-10-0${(i % 9) + 1}T08:00:00Z`), ...extra });
    const leads = await env.db
      .insert(s.leads)
      .values([
        mk(1, { stage: "won" }),
        mk(2, { stage: "won" }),
        mk(3, { stage: "lost", lostReason: "Bought elsewhere" }),
        mk(4, { stage: "contacted", nextActionAt: new Date("2026-10-10T00:00:00Z"), lastContactAt: new Date("2026-10-02T00:00:00Z") }),
        mk(5, { stage: "new" }),
      ])
      .returning();
    // First contact 2h and 6h after creation: median 4h.
    await env.db.insert(s.leadActivities).values([
      { tenantId: env.a.id, leadId: leads[0]!.id, type: "call", summary: "Call", userId: agent, occurredAt: new Date(leads[0]!.createdAt.getTime() + 2 * 3_600_000) },
      { tenantId: env.a.id, leadId: leads[1]!.id, type: "whatsapp", summary: "WA", userId: agent, occurredAt: new Date(leads[1]!.createdAt.getTime() + 6 * 3_600_000) },
      { tenantId: env.a.id, leadId: leads[1]!.id, type: "viewing", summary: "Viewing", userId: agent, occurredAt: new Date("2026-10-12T10:00:00Z") },
      { tenantId: env.a.id, leadId: leads[2]!.id, type: "note", summary: "Note", userId: agent, occurredAt: new Date("2026-10-12T10:00:00Z") },
    ]);
  });

  it("computes conversion, response, activity, overdue and stale from the records", async () => {
    const { start, end } = t.bounds("2026-10");
    const m = (await t.computeMetrics(env.db, env.a.id, [agent], start, end, now)).get(agent)!;
    expect(m).toMatchObject({ leadsAssigned: 5, leadsWon: 2, leadsLost: 1, conversionPct: 66.7, medianResponseHours: 4, activities: 3, calls: 1, messages: 1, viewings: 1, overdueFollowUps: 1, staleLeads: 2 });
  });

  it("snapshots a period, keeps coaching notes across recomputes, exports CSV and stays within the firm", async () => {
    await t.snapshot(env.db, env.a.id, "2026-10", now);
    await t.addCoachingNote(env.db, env.a.id, agent, "2026-10", { text: "Agreed to clear overdue follow-ups by Thursday.", flag: "overdue_followups", by: "Admin A" });
    await t.snapshot(env.db, env.a.id, "2026-10", now);
    const [row] = await env.db.select().from(s.agentMetrics).where(eq(s.agentMetrics.userId, agent));
    expect(row!.notes).toHaveLength(1);
    const v = await t.teamView(env.db, env.a.id, "2026-10");
    expect(v.snap?.headcount).toBe(1);
    expect(v.snap?.leaderboards.conversionPct?.[0]).toMatchObject({ name: "Rohan Mehta", rank: 1 });
    const csv = await t.exportCsv(env.db, env.a.id, "2026-10");
    expect(csv.split("\r\n")[0]).toContain("Lead conversion (%)");
    expect(csv).toContain("Rohan Mehta,rohan@a.example.com,2026-10");
    expect((await t.teamView(env.db, env.b.id, "2026-10")).rows).toEqual([]);
    await expect(t.agentView(env.db, env.b.id, agent, "2026-10")).rejects.toThrow(/not found/i);
  });

  it("backfills history and recomputes the open month", async () => {
    await t.ensureHistory(env.db, env.a.id, 3, now);
    const snaps = await env.db.select({ p: s.teamPerformanceSnapshots.period }).from(s.teamPerformanceSnapshots).where(eq(s.teamPerformanceSnapshots.tenantId, env.a.id));
    expect(snaps.map((x) => x.p).sort()).toEqual(["2026-08", "2026-09", "2026-10"]);
    expect(t.previousPeriods("2026-01", 3)).toEqual(["2026-01", "2025-12", "2025-11"]);
  });
});
