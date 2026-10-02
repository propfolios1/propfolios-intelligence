import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { latestCrossValidation } from "@/lib/ai/cross-validation";
import { loadMandateBundle } from "@/lib/ai/context";
import { runCrossValidation } from "@/lib/ai/orchestrator";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { scope } from "@/lib/tenant-db";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  return NextResponse.json(await latestCrossValidation(await getDb(), user.tenantId, id));
});

/** Runs the three-model review now. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  await enforceRateLimit(user, "agents");
  const { id } = await params;
  const db = await getDb();
  const b = await loadMandateBundle(db, id, user.tenantId);
  if (!b) throw new HttpError(404, "Mandate not found.");
  const r = await runCrossValidation(db, b, { tenantId: user.tenantId, mandateId: id, actor: user.name });
  await audit(user, `ran cross-validation (${r.row.agreement})`, { entityType: "mandate", entityId: id, mandateId: id, detail: { consensus: r.row.consensus, flagged: r.row.flagged } });
  return NextResponse.json(r.row, { status: 201 });
});

/** A person resolves a flagged disagreement. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const { resolution } = await parseBody(req, z.object({ resolution: z.string().trim().min(10).max(1000) }));
  const db = await getDb();
  const cv = await latestCrossValidation(db, user.tenantId, id);
  if (!cv) throw new HttpError(404, "No cross-validation on this mandate.");
  const [row] = await db.update(s.crossValidations).set({ resolvedBy: user.name, resolvedAt: new Date(), resolution }).where(eq(s.crossValidations.id, cv.id)).returning();
  await db.update(s.mandates).set({ requiresReview: false }).where(scope(s.mandates, user.tenantId, eq(s.mandates.id, id)));
  await audit(user, "resolved cross-validation flag", { entityType: "mandate", entityId: id, mandateId: id, detail: { resolution } });
  return NextResponse.json(row);
});
