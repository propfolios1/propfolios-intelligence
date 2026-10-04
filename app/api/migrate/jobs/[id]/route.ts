import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { connect, dryRun, extractStep, getJob, jobLogs, loadStep, preview, rollback, rules, saveMapping, stageCsv } from "@/lib/migration/engine";
import { SOURCES } from "@/lib/migration/sources";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  const db = await getDb();
  const job = await getJob(db, user.tenantId, (await params).id);
  const [maps, logs, sample] = await Promise.all([rules(db, job.id), jobLogs(db, job.id), job.extracted ? preview(db, job) : Promise.resolve([])]);
  return NextResponse.json({ job: { ...job, credentials: undefined, connected: Boolean(job.credentials) }, rules: maps, logs, preview: sample });
});

const transform = z.enum(["none", "trim", "lowercase", "titlecase", "phone", "number", "date", "split_list", "value_map"]);
const mapping = z.object({ rules: z.array(z.object({ sourceField: z.string().min(1).max(200), targetField: z.string().min(1).max(60), transform, valueMap: z.record(z.string().max(120), z.string().max(60)).optional() })).max(60) });

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const db = await getDb();
  const job = await getJob(db, user.tenantId, (await params).id);
  const b = await parseBody(req, mapping);
  const targets = b.rules.map((r) => r.targetField);
  if (new Set(targets).size !== targets.length) throw new HttpError(422, "Each Nakhla field can be filled from one source field only.");
  await saveMapping(db, job, b.rules);
  return NextResponse.json({ ok: true, preview: await preview(db, await getJob(db, user.tenantId, job.id)) });
});

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("upload"), fileName: z.string().min(1).max(200), text: z.string().min(1).max(25_000_000) }),
  z.object({ action: z.literal("connect"), apiKey: z.string().trim().min(8).max(400), account: z.string().trim().max(120).optional() }),
  z.object({ action: z.literal("extract") }),
  z.object({ action: z.literal("dry_run") }),
  z.object({ action: z.literal("load") }),
  z.object({ action: z.literal("rollback") }),
]);

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const db = await getDb();
  const job = await getJob(db, user.tenantId, (await params).id);
  const b = await parseBody(req, action);
  const actor = { id: user.impersonating ? null : user.id, name: user.name };
  switch (b.action) {
    case "upload":
      await enforceRateLimit(user, "upload");
      await stageCsv(db, job, b.text, b.fileName);
      await audit(user, `uploaded ${b.fileName} to import ${job.reference}`, { entityType: "migration_job", entityId: job.id });
      break;
    case "connect": {
      if (SOURCES[job.source].auth !== "api_key") throw new HttpError(422, `${SOURCES[job.source].name} connects through its own sign-in.`);
      await connect(db, job, { apiKey: b.apiKey }, b.account ?? null);
      // The first page proves the key works; a rejected key fails here, before anything else is stored.
      const fresh = await getJob(db, user.tenantId, job.id);
      const first = await extractStep(db, fresh);
      await audit(user, `connected ${SOURCES[job.source].name} for import ${job.reference}`, { entityType: "migration_job", entityId: job.id });
      return NextResponse.json(first);
    }
    case "extract":
      return NextResponse.json(await extractStep(db, job));
    case "dry_run":
      return NextResponse.json({ totals: await dryRun(db, job) });
    case "load": {
      const r = await loadStep(db, job, actor);
      if (r.done) await audit(user, `completed import ${job.reference}`, { entityType: "migration_job", entityId: job.id, detail: r.totals });
      return NextResponse.json(r);
    }
    case "rollback": {
      const r = await rollback(db, job, actor);
      await audit(user, `rolled back import ${job.reference}`, { entityType: "migration_job", entityId: job.id, detail: r });
      return NextResponse.json(r);
    }
  }
  return NextResponse.json({ ok: true });
});
