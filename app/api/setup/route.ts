import { NextResponse } from "next/server";
import { dbKind, getDb, hasExternalDb, migrateExternal } from "@/db";
import { isSeeded, seed } from "@/db/seed";
import { ensureCron } from "@/lib/jobs/cron";
import { ensureBuckets } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorised(req: Request) {
  const secret = process.env.SETUP_SECRET;
  if (!secret) return { ok: false, reason: "SETUP_SECRET is not set in the environment." };
  const url = new URL(req.url);
  const given = req.headers.get("x-setup-secret") ?? url.searchParams.get("secret");
  return given === secret ? { ok: true } : { ok: false, reason: "Invalid setup secret." };
}

/**
 * Creates tables (migrations), seeds demo data and schedules the Supabase
 * Cron jobs (pg_cron, pg_net and Vault). Idempotent.
 * GET  /api/setup?secret=…            migrate + seed if empty
 * GET  /api/setup?secret=…&reset=1    wipe and reseed
 * POST /api/setup  (x-setup-secret)   same as GET
 */
async function run(req: Request) {
  const auth = authorised(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });
  const reset = new URL(req.url).searchParams.get("reset") === "1";
  const started = Date.now();
  if (hasExternalDb()) await migrateExternal();
  const db = await getDb();
  const already = await isSeeded(db);
  const result = await seed(db, { force: reset });
  const cron = hasExternalDb() ? await ensureCron(db).catch((e: Error) => ({ available: false, reason: e.message, scheduled: [] as string[], skipped: [], vault: false })) : { available: false, reason: "The embedded demonstration database has no pg_cron.", scheduled: [] as string[], skipped: [], vault: false };
  const storage = await ensureBuckets().catch((e: Error) => ({ created: [] as string[], provider: "error" as const, error: e.message }));
  return NextResponse.json({
    ok: true,
    database: dbKind(),
    migrated: true,
    seeded: result.seeded,
    upgraded: "upgraded" in result ? result.upgraded : undefined,
    note: result.seeded ? (reset ? "Data wiped and reseeded." : "Demo data created.") : already ? "Already seeded: missing catalogue and module data added without changing existing records. Add &reset=1 to wipe and reseed." : "No changes.",
    counts: "counts" in result ? result.counts : undefined,
    storage,
    cron,
    ms: Date.now() - started,
  });
}

export const GET = run;
export const POST = run;
