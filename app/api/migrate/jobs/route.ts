import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { MIGRATION_SOURCES } from "@/db/schema-production";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { MARKET_CODES } from "@/lib/markets";
import { createJob, listJobs } from "@/lib/migration/engine";
import { enforceRateLimit } from "@/lib/rate-limit";

const strip = <T extends { credentials: string | null }>(j: T) => ({ ...j, credentials: undefined, connected: Boolean(j.credentials) });

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  return NextResponse.json({ jobs: (await listJobs(await getDb(), user.tenantId)).map(strip) });
});

const body = z.object({ source: z.enum(MIGRATION_SOURCES), entity: z.enum(["leads", "listings"]), defaultMarket: z.enum(MARKET_CODES) });

/** Starts an import. CSV imports take their file next; CRM imports connect next. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  await enforceRateLimit(user, "write");
  const b = await parseBody(req, body);
  const job = await createJob(await getDb(), user.tenantId, b, { id: user.id, name: user.name });
  await audit(user, `started import ${job.reference}`, { entityType: "migration_job", entityId: job.id, detail: { source: b.source, entity: b.entity } });
  return NextResponse.json({ id: job.id, reference: job.reference }, { status: 201 });
});
