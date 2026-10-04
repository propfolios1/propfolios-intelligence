import "server-only";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { HANDLERS, type JobParams } from "./handlers";
import { installFeatureJobs } from "./install";
import { JOB_INDEX } from "./registry";

/** A run still marked running after this long is treated as abandoned. */
const STALE_MS = 15 * 60_000;

/**
 * Runs a job once and records it in job_runs. Overlapping runs of the same
 * job are skipped, and a repeated idempotency key returns the earlier run, so
 * a retried cron call never does the work twice.
 */
export async function runJob(db: DB, name: string, opts: { trigger: "cron" | "manual"; idempotencyKey?: string | null; actor?: string; params?: JobParams } = { trigger: "cron" }) {
  installFeatureJobs();
  const def = JOB_INDEX[name];
  if (!def) throw new HttpError(404, `No job named ${name}.`);
  if (opts.idempotencyKey) {
    const [prior] = await db.select().from(s.jobRuns).where(and(eq(s.jobRuns.job, name), eq(s.jobRuns.idempotencyKey, opts.idempotencyKey)));
    if (prior) return { run: prior, replayed: true };
  }
  const [busy] = await db.select({ id: s.jobRuns.id }).from(s.jobRuns).where(and(eq(s.jobRuns.job, name), eq(s.jobRuns.status, "running"), gte(s.jobRuns.startedAt, new Date(Date.now() - STALE_MS))));
  if (busy) {
    const [run] = await db.insert(s.jobRuns).values({ job: name, trigger: opts.trigger, status: "skipped", idempotencyKey: opts.idempotencyKey ?? null, finishedAt: new Date(), durationMs: 0, result: { reason: "An earlier run is still in progress." }, actor: opts.actor ?? null }).returning();
    return { run: run!, replayed: false };
  }
  const [run] = await db.insert(s.jobRuns).values({ job: name, trigger: opts.trigger, idempotencyKey: opts.idempotencyKey ?? null, actor: opts.actor ?? null }).returning();
  const started = Date.now();
  try {
    let result: Record<string, unknown>;
    if (def.kind === "sql") {
      await db.execute(sql.raw(def.sql));
      result = { executed: def.sql };
    } else {
      const handler = HANDLERS[name];
      if (!handler) throw new Error(`The ${def.label} handler is not installed in this release.`);
      result = await handler(db, opts.params ?? {});
    }
    const [done] = await db.update(s.jobRuns).set({ status: "succeeded", finishedAt: new Date(), durationMs: Date.now() - started, result }).where(eq(s.jobRuns.id, run!.id)).returning();
    return { run: done!, replayed: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const [failed] = await db.update(s.jobRuns).set({ status: "failed", finishedAt: new Date(), durationMs: Date.now() - started, error: message.slice(0, 2000) }).where(eq(s.jobRuns.id, run!.id)).returning();
    return { run: failed!, replayed: false };
  }
}

export async function recentRuns(db: DB, name?: string, limit = 50) {
  return db.select().from(s.jobRuns).where(name ? eq(s.jobRuns.job, name) : undefined).orderBy(desc(s.jobRuns.startedAt)).limit(limit);
}
