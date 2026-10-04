import "server-only";
import { and, desc, eq, gte, inArray, isNotNull, lt, notInArray, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { AgentMetricSet, CoachingNote } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { quarter } from "@/lib/brokerage/team";
import { scope } from "@/lib/tenant-db";
import { coachingFlags, leaderboard, median, medians, METRICS, totals } from "./coaching";

const DAY = 86_400_000;
const CONTACT = ["call", "whatsapp", "email", "viewing"] as const;

export const periodOf = (d = new Date()) => d.toISOString().slice(0, 7);
export function bounds(period: string) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return { start: new Date(Date.UTC(y, m - 1, 1)), end: new Date(Date.UTC(y, m, 1)) };
}
export const previousPeriods = (period: string, n: number) => {
  const [y, m] = period.split("-").map(Number) as [number, number];
  return Array.from({ length: n }, (_, i) => new Date(Date.UTC(y, m - 1 - i, 1)).toISOString().slice(0, 7));
};

export async function staff(db: DB, tenantId: string) {
  return db.select({ id: s.users.id, name: s.users.name, email: s.users.email, role: s.users.role }).from(s.users).where(scope(s.users, tenantId, inArray(s.users.role, ["analyst", "tenant_admin"]))).orderBy(s.users.name);
}

/** Every metric for each person over [start, end), computed from leads, activities, listings, deals and commission splits. */
export async function computeMetrics(db: DB, tenantId: string, userIds: string[], start: Date, end: Date, now = new Date()): Promise<Map<string, AgentMetricSet>> {
  const out = new Map<string, AgentMetricSet>();
  if (!userIds.length) return out;
  const inPeriod = (col: Parameters<typeof gte>[0]) => and(gte(col, start), lt(col, end));
  const asOf = end < now ? end : now;
  const [assigned, decided, firstContact, acts, bookings, listingsTaken, active, deals, gci, pipeline, overdue, stale] = await Promise.all([
    db.select({ u: s.leads.ownerUserId, n: sql<number>`count(*)::int`, contacted: sql<number>`count(*) filter (where ${s.leads.lastContactAt} is not null)::int` }).from(s.leads).where(scope(s.leads, tenantId, inArray(s.leads.ownerUserId, userIds), inPeriod(s.leads.createdAt))).groupBy(s.leads.ownerUserId),
    db.select({ u: s.leads.ownerUserId, won: sql<number>`count(*) filter (where ${s.leads.stage} = 'won')::int`, lost: sql<number>`count(*) filter (where ${s.leads.stage} = 'lost')::int` }).from(s.leads).where(scope(s.leads, tenantId, inArray(s.leads.ownerUserId, userIds), inArray(s.leads.stage, ["won", "lost"]), inPeriod(s.leads.updatedAt))).groupBy(s.leads.ownerUserId),
    db
      .select({ u: s.leads.ownerUserId, hours: sql<number>`(extract(epoch from (min(${s.leadActivities.occurredAt}) - ${s.leads.createdAt})) / 3600)::float8` })
      .from(s.leads)
      .innerJoin(s.leadActivities, and(eq(s.leadActivities.leadId, s.leads.id), inArray(s.leadActivities.type, [...CONTACT])))
      .where(scope(s.leads, tenantId, inArray(s.leads.ownerUserId, userIds), inPeriod(s.leads.createdAt)))
      .groupBy(s.leads.id, s.leads.ownerUserId, s.leads.createdAt),
    db.select({ u: s.leadActivities.userId, type: s.leadActivities.type, n: sql<number>`count(*)::int` }).from(s.leadActivities).where(scope(s.leadActivities, tenantId, inArray(s.leadActivities.userId, userIds), inArray(s.leadActivities.type, [...CONTACT]), inPeriod(s.leadActivities.occurredAt))).groupBy(s.leadActivities.userId, s.leadActivities.type),
    db.select({ u: s.viewingBookings.agentUserId, n: sql<number>`count(*)::int` }).from(s.viewingBookings).where(scope(s.viewingBookings, tenantId, inArray(s.viewingBookings.agentUserId, userIds), inPeriod(s.viewingBookings.startsAt))).groupBy(s.viewingBookings.agentUserId),
    db.select({ u: s.listings.agentUserId, n: sql<number>`count(*)::int` }).from(s.listings).where(scope(s.listings, tenantId, inArray(s.listings.agentUserId, userIds), inPeriod(s.listings.createdAt))).groupBy(s.listings.agentUserId),
    db.select({ u: s.listings.agentUserId, n: sql<number>`count(*)::int`, dom: sql<number | null>`avg(extract(epoch from (${asOf}::timestamptz - coalesce(${s.listings.listedAt}, ${s.listings.createdAt}))) / 86400)::float8` }).from(s.listings).where(scope(s.listings, tenantId, inArray(s.listings.agentUserId, userIds), inArray(s.listings.status, ["active", "under_offer"]), lt(s.listings.createdAt, end))).groupBy(s.listings.agentUserId),
    db.select({ u: s.deals.ownerUserId, n: sql<number>`count(*)::int`, v: sql<number>`coalesce(sum(${s.deals.value}),0)::float8` }).from(s.deals).where(scope(s.deals, tenantId, inArray(s.deals.ownerUserId, userIds), eq(s.deals.status, "won"), sql`${s.deals.actualCloseDate} >= ${start.toISOString().slice(0, 10)}::date and ${s.deals.actualCloseDate} < ${end.toISOString().slice(0, 10)}::date`)).groupBy(s.deals.ownerUserId),
    db.select({ u: s.splits.userId, v: sql<number>`coalesce(sum(${s.splits.amount}),0)::float8` }).from(s.splits).where(scope(s.splits, tenantId, inArray(s.splits.userId, userIds), inPeriod(s.splits.createdAt))).groupBy(s.splits.userId),
    db.select({ u: s.deals.ownerUserId, v: sql<number>`coalesce(sum(${s.deals.value} * coalesce(${s.deals.probability}, 0.3)),0)::float8` }).from(s.deals).where(scope(s.deals, tenantId, inArray(s.deals.ownerUserId, userIds), eq(s.deals.status, "active"))).groupBy(s.deals.ownerUserId),
    db.select({ u: s.leads.ownerUserId, n: sql<number>`count(*)::int` }).from(s.leads).where(scope(s.leads, tenantId, inArray(s.leads.ownerUserId, userIds), notInArray(s.leads.stage, ["won", "lost"]), isNotNull(s.leads.nextActionAt), lt(s.leads.nextActionAt, asOf))).groupBy(s.leads.ownerUserId),
    db.select({ u: s.leads.ownerUserId, n: sql<number>`count(*)::int` }).from(s.leads).where(scope(s.leads, tenantId, inArray(s.leads.ownerUserId, userIds), notInArray(s.leads.stage, ["won", "lost"]), lt(s.leads.createdAt, new Date(asOf.getTime() - 7 * DAY)), or(sql`${s.leads.lastContactAt} is null`, lt(s.leads.lastContactAt, new Date(asOf.getTime() - 7 * DAY))))).groupBy(s.leads.ownerUserId),
  ]);
  const one = <T extends { u: string | null }>(rows: T[], id: string) => rows.find((r) => r.u === id);
  for (const id of userIds) {
    const a = one(assigned, id);
    const d = one(decided, id);
    const won = d?.won ?? 0;
    const lost = d?.lost ?? 0;
    const myActs = acts.filter((x) => x.u === id);
    const count = (types: string[]) => myActs.filter((x) => types.includes(x.type)).reduce((t, x) => t + x.n, 0);
    const resp = median(firstContact.filter((x) => x.u === id && x.hours >= 0).map((x) => x.hours));
    out.set(id, {
      leadsAssigned: a?.n ?? 0,
      leadsContacted: a?.contacted ?? 0,
      leadsWon: won,
      leadsLost: lost,
      conversionPct: won + lost ? Math.round((won / (won + lost)) * 1000) / 10 : null,
      medianResponseHours: resp === null ? null : Math.round(resp * 10) / 10,
      activities: count([...CONTACT]),
      calls: count(["call"]),
      messages: count(["whatsapp", "email"]),
      viewings: count(["viewing"]) + (one(bookings, id)?.n ?? 0),
      listingsTaken: one(listingsTaken, id)?.n ?? 0,
      activeListings: one(active, id)?.n ?? 0,
      avgDaysOnMarket: one(active, id)?.dom === null || one(active, id)?.dom === undefined ? null : Math.round(one(active, id)!.dom! * 10) / 10,
      dealsClosed: one(deals, id)?.n ?? 0,
      dealValue: one(deals, id)?.v ?? 0,
      gci: Math.round((one(gci, id)?.v ?? 0) * 100) / 100,
      pipelineValue: Math.round(one(pipeline, id)?.v ?? 0),
      overdueFollowUps: one(overdue, id)?.n ?? 0,
      staleLeads: one(stale, id)?.n ?? 0,
    });
  }
  return out;
}

/** Computes and stores a period for a firm: each person's metrics and flags (notes are kept), and the team snapshot. */
export async function snapshot(db: DB, tenantId: string, period: string, now = new Date()) {
  const { start, end } = bounds(period);
  const people = await staff(db, tenantId);
  const metrics = await computeMetrics(db, tenantId, people.map((p) => p.id), start, end, now);
  const rows = people.map((p) => ({ userId: p.id, name: p.name, m: metrics.get(p.id)! }));
  // Only people with any activity in the period set the medians, so a new hire or an administrator does not drag them down.
  const activeRows = rows.filter((r) => r.m.leadsAssigned + r.m.activities + r.m.dealsClosed + r.m.listingsTaken > 0);
  const med = medians(activeRows.map((r) => r.m));
  const q = quarter(start);
  const targets = await db.select().from(s.teamTargets).where(scope(s.teamTargets, tenantId, eq(s.teamTargets.period, q.label)));
  const elapsed = Math.min(1, Math.max(0, (Math.min(now.getTime(), q.end.getTime()) - q.start.getTime()) / (q.end.getTime() - q.start.getTime())));
  const existing = await db.select({ userId: s.agentMetrics.userId, notes: s.agentMetrics.notes }).from(s.agentMetrics).where(scope(s.agentMetrics, tenantId, eq(s.agentMetrics.period, period)));
  let flagged = 0;
  for (const r of rows) {
    const t = targets.filter((x) => x.userId === r.userId);
    const flags = activeRows.includes(r) ? coachingFlags(r.m, med, { target: { gci: t.find((x) => x.metric === "gci")?.target ?? null, dealsClosed: t.find((x) => x.metric === "deals_closed")?.target ?? null }, periodElapsed: elapsed }) : [];
    if (flags.some((f) => f.kind === "concern")) flagged++;
    const notes: CoachingNote[] = existing.find((e) => e.userId === r.userId)?.notes ?? [];
    await db
      .insert(s.agentMetrics)
      .values({ tenantId, userId: r.userId, period, metrics: r.m, flags, notes, computedAt: now })
      .onConflictDoUpdate({ target: [s.agentMetrics.userId, s.agentMetrics.period], set: { metrics: r.m, flags, computedAt: now } });
  }
  const boards = Object.fromEntries(METRICS.filter((m) => ["gci", "dealsClosed", "conversionPct", "medianResponseHours", "viewings", "listingsTaken"].includes(m.key)).map((m) => [m.key, leaderboard(activeRows, m.key, m.better)]));
  const values = { tenantId, period, totals: totals(rows.map((r) => r.m)), medians: med, leaderboards: boards, headcount: activeRows.length, flagged, computedAt: now };
  await db.insert(s.teamPerformanceSnapshots).values(values).onConflictDoUpdate({ target: [s.teamPerformanceSnapshots.tenantId, s.teamPerformanceSnapshots.period], set: values });
  return { period, people: rows.length, active: activeRows.length, flagged };
}

/** Fills any of the last `months` periods that have never been computed (first visit to the dashboard). */
export async function ensureHistory(db: DB, tenantId: string, months = 6, now = new Date()) {
  const want = previousPeriods(periodOf(now), months);
  const have = await db.select({ period: s.teamPerformanceSnapshots.period, at: s.teamPerformanceSnapshots.computedAt }).from(s.teamPerformanceSnapshots).where(scope(s.teamPerformanceSnapshots, tenantId, inArray(s.teamPerformanceSnapshots.period, want)));
  for (const p of want) {
    const h = have.find((x) => x.period === p);
    // The current month is refreshed when older than an hour; closed months once.
    if (!h || (p === periodOf(now) && now.getTime() - h.at.getTime() > 3_600_000)) await snapshot(db, tenantId, p, now);
  }
}

/** Nightly: today's month for every firm, and last month during the first three days (late-logged activity). */
export async function runTeamSnapshots(db: DB, opts: { now?: Date; tenantIds?: string[] } = {}) {
  const now = opts.now ?? new Date();
  const tenants = await db.select({ id: s.tenants.id }).from(s.tenants).where(opts.tenantIds?.length ? inArray(s.tenants.id, opts.tenantIds) : sql`true`);
  const periods = [periodOf(now), ...(now.getUTCDate() <= 3 ? [previousPeriods(periodOf(now), 2)[1]!] : [])];
  let n = 0;
  for (const t of tenants) for (const p of periods) {
    await snapshot(db, t.id, p, now);
    n++;
  }
  return { snapshots: n };
}

export async function teamView(db: DB, tenantId: string, period: string) {
  const [snap] = await db.select().from(s.teamPerformanceSnapshots).where(scope(s.teamPerformanceSnapshots, tenantId, eq(s.teamPerformanceSnapshots.period, period)));
  const rows = await db.select({ a: s.agentMetrics, name: s.users.name, email: s.users.email }).from(s.agentMetrics).innerJoin(s.users, eq(s.users.id, s.agentMetrics.userId)).where(scope(s.agentMetrics, tenantId, eq(s.agentMetrics.period, period))).orderBy(desc(sql`(${s.agentMetrics.metrics}->>'gci')::float8`));
  const trend = await db.select({ period: s.teamPerformanceSnapshots.period, totals: s.teamPerformanceSnapshots.totals, medians: s.teamPerformanceSnapshots.medians }).from(s.teamPerformanceSnapshots).where(scope(s.teamPerformanceSnapshots, tenantId, inArray(s.teamPerformanceSnapshots.period, previousPeriods(period, 12)))).orderBy(s.teamPerformanceSnapshots.period);
  return { snap: snap ?? null, rows, trend };
}

export async function agentView(db: DB, tenantId: string, userId: string, period: string) {
  const [u] = await db.select({ id: s.users.id, name: s.users.name, email: s.users.email, role: s.users.role }).from(s.users).where(scope(s.users, tenantId, eq(s.users.id, userId)));
  if (!u) throw new HttpError(404, "Team member not found.");
  const history = await db.select().from(s.agentMetrics).where(scope(s.agentMetrics, tenantId, eq(s.agentMetrics.userId, userId), inArray(s.agentMetrics.period, previousPeriods(period, 12)))).orderBy(s.agentMetrics.period);
  const [snap] = await db.select().from(s.teamPerformanceSnapshots).where(scope(s.teamPerformanceSnapshots, tenantId, eq(s.teamPerformanceSnapshots.period, period)));
  const overdueLeads = await db.select({ id: s.leads.id, name: s.leads.name, reference: s.leads.reference, nextAction: s.leads.nextAction, nextActionAt: s.leads.nextActionAt, stage: s.leads.stage }).from(s.leads).where(scope(s.leads, tenantId, eq(s.leads.ownerUserId, userId), notInArray(s.leads.stage, ["won", "lost"]), lt(s.leads.nextActionAt, new Date()))).orderBy(s.leads.nextActionAt).limit(15);
  return { user: u, current: history.find((h) => h.period === period) ?? null, history, snap: snap ?? null, overdueLeads };
}

export async function addCoachingNote(db: DB, tenantId: string, userId: string, period: string, note: { text: string; flag: string | null; by: string }) {
  const [row] = await db.select().from(s.agentMetrics).where(scope(s.agentMetrics, tenantId, eq(s.agentMetrics.userId, userId), eq(s.agentMetrics.period, period)));
  if (!row) throw new HttpError(404, "No metrics for this person and period yet.");
  const notes = [...row.notes, { at: new Date().toISOString(), by: note.by, text: note.text, flag: note.flag }];
  const [u] = await db.update(s.agentMetrics).set({ notes }).where(eq(s.agentMetrics.id, row.id)).returning();
  return u!;
}

const FMT: Record<string, (v: number | null) => string> = { count: (v) => String(v ?? ""), pct: (v) => (v === null ? "" : String(v)), hours: (v) => (v === null ? "" : String(v)), days: (v) => (v === null ? "" : String(v)), money: (v) => (v === null ? "" : v.toFixed(2)) };

export async function exportCsv(db: DB, tenantId: string, period: string) {
  const { rows } = await teamView(db, tenantId, period);
  const header = ["Name", "Email", "Period", ...METRICS.map((m) => `${m.label}${m.format === "pct" ? " (%)" : m.format === "hours" ? " (hours)" : m.format === "days" ? " (days)" : ""}`), "Concerns", "Recognitions"];
  const esc = (v: string) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = rows.map((r) => [r.name, r.email ?? "", period, ...METRICS.map((m) => FMT[m.format]!(r.a.metrics[m.key] as number | null)), r.a.flags.filter((f) => f.kind === "concern").map((f) => f.title).join("; "), r.a.flags.filter((f) => f.kind === "recognition").map((f) => f.title).join("; ")].map((v) => cell(esc(v))).join(","));
  return [header.join(","), ...lines].join("\r\n") + "\r\n";
}
