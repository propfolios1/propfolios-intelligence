import "server-only";
import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import { type JobDef, JOBS } from "./registry";

/**
 * Supabase Cron. Enables pg_cron and pg_net, stores the project URL and the
 * service role key in Supabase Vault, and schedules every job in the registry
 * by name (re-scheduling an existing name updates it in place). On a database
 * without pg_cron (local Postgres, the embedded demo database) it reports why
 * and changes nothing.
 */

export type CronStatus = { available: boolean; reason?: string; scheduled: string[]; skipped: { job: string; reason: string }[]; vault: boolean };

type Row = Record<string, unknown>;
const rowsOf = (r: unknown): Row[] => (Array.isArray(r) ? (r as Row[]) : ((r as { rows?: Row[] })?.rows ?? []));

async function q(db: DB, query: ReturnType<typeof sql>) {
  return rowsOf(await db.execute(query));
}

export async function cronAvailability(db: DB) {
  const ext = await q(db, sql`select name, installed_version from pg_available_extensions where name in ('pg_cron', 'pg_net', 'vector')`);
  const has = (n: string) => ext.find((e) => e.name === n);
  // net.http_post is what the jobs call; it exists once pg_net is installed.
  const [fn] = await q(db, sql`select to_regprocedure('net.http_post(text,jsonb,jsonb,integer)') is not null as present`);
  const netFn = Boolean(fn?.present);
  return { pgCron: Boolean(has("pg_cron")), pgCronInstalled: Boolean(has("pg_cron")?.installed_version), pgNet: Boolean(has("pg_net")) || netFn, pgNetInstalled: Boolean(has("pg_net")?.installed_version) || netFn };
}

/** The pg_net command a cron job runs for an HTTP job: POST to the edge function with the service role key from Vault. */
export function httpCommand(fn: string) {
  return `select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/${fn}',
    headers := jsonb_build_object(
      'Content-type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := jsonb_build_object('scheduled_at', now()),
    timeout_milliseconds := 30000
  );`;
}

export const commandFor = (j: JobDef) => (j.kind === "sql" ? j.sql : httpCommand(j.fn));

async function upsertSecret(db: DB, name: string, value: string) {
  const [existing] = await q(db, sql`select id from vault.secrets where name = ${name}`);
  if (existing) await db.execute(sql`select vault.update_secret(${existing.id as string}::uuid, ${value})`);
  else await db.execute(sql`select vault.create_secret(${value}, ${name})`);
}

export async function ensureCron(db: DB): Promise<CronStatus> {
  const status: CronStatus = { available: false, scheduled: [], skipped: [], vault: false };
  const a = await cronAvailability(db);
  if (!a.pgCron || !a.pgNet) return { ...status, reason: "pg_cron or pg_net is not available on this database. On Supabase both are; locally, jobs run from Administration > System health." };
  try {
    if (!a.pgCronInstalled) await db.execute(sql`create extension if not exists pg_cron`);
    if (!a.pgNetInstalled) await db.execute(sql`create extension if not exists pg_net with schema extensions`);
  } catch (e) {
    return { ...status, reason: `Could not enable pg_cron and pg_net: ${(e as Error).message}. Enable them under Database > Extensions in Supabase, then run setup again.` };
  }
  status.available = true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    try {
      await upsertSecret(db, "project_url", url);
      await upsertSecret(db, "service_role_key", key);
      status.vault = true;
    } catch (e) {
      status.reason = `Vault unavailable: ${(e as Error).message}`;
    }
  }
  for (const j of JOBS) {
    if (j.kind === "http" && !status.vault) {
      status.skipped.push({ job: j.name, reason: "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to call the edge functions." });
      continue;
    }
    await db.execute(sql`select cron.schedule(${j.name}, ${j.schedule}, ${commandFor(j)})`);
    status.scheduled.push(j.name);
  }
  return status;
}

export type CronJobRow = { jobid: number; jobname: string; schedule: string; active: boolean; lastStart: string | null; lastEnd: string | null; lastStatus: string | null; lastMessage: string | null; failures24h: number };

/** Scheduled jobs and their latest pg_cron run, or null when pg_cron is not installed. */
export async function cronJobs(db: DB): Promise<CronJobRow[] | null> {
  const a = await cronAvailability(db);
  if (!a.pgCronInstalled) return null;
  const rows = await q(
    db,
    sql`select j.jobid, j.jobname, j.schedule, j.active,
      d.start_time as last_start, d.end_time as last_end, d.status as last_status, d.return_message as last_message,
      (select count(*)::int from cron.job_run_details f where f.jobid = j.jobid and f.status = 'failed' and f.start_time > now() - interval '24 hours') as failures
    from cron.job j
    left join lateral (select * from cron.job_run_details r where r.jobid = j.jobid order by r.start_time desc limit 1) d on true
    order by j.jobname`,
  );
  const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
  return rows.map((r) => ({ jobid: Number(r.jobid), jobname: String(r.jobname), schedule: String(r.schedule), active: Boolean(r.active), lastStart: iso(r.last_start), lastEnd: iso(r.last_end), lastStatus: (r.last_status as string) ?? null, lastMessage: (r.last_message as string) ?? null, failures24h: Number(r.failures ?? 0) }));
}
