import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { mandateForUser } from "@/lib/ai/guard";
import { markDelivered, PIPELINE } from "@/lib/ai/orchestrator";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { getMandateDetail } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  const db = await getDb();
  return NextResponse.json(await getMandateDetail(db, user, id));
});

const patch = z.object({
  title: z.string().trim().min(3).max(120).optional(),
  brief: z.string().trim().min(20).max(4000).optional(),
  objective: z.string().trim().min(3).max(200).optional(),
  priority: z.enum(["standard", "priority"]).optional(),
  deadline: z.iso.date().nullable().optional(),
  ticketSizeAed: z.number().positive().optional(),
  horizonYears: z.number().int().min(1).max(15).optional(),
  status: z.enum(PIPELINE.map((p) => p.stage) as [string, ...string[]]).optional(),
});

/** Edits mandate fields. Status moves (from the kanban board) are restricted to valid transitions. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["admin", "analyst"]);
  const { id } = await params;
  const db = await getDb();
  const m = await mandateForUser(db, user, id);
  const { status, ...fields } = await parseBody(req, patch);
  if (status && status !== m.status) {
    if (m.runningSince) throw new HttpError(409, "Agents are working on this mandate. Wait for the current stage to finish.");
    const from = PIPELINE.findIndex((p) => p.stage === m.status);
    const to = PIPELINE.findIndex((p) => p.stage === status);
    if (status === "DELIVERED") {
      if (m.status !== "REVIEW") throw new HttpError(409, "Only mandates in review can be delivered. Approve the memo first.");
      const [memo] = await db.select({ status: s.memos.status }).from(s.memos).where(eq(s.memos.mandateId, id));
      if (memo?.status !== "approved" && memo?.status !== "delivered") throw new HttpError(409, "Approve the memo before delivering the mandate.");
      await markDelivered(db, id, user.name);
      await db.update(s.memos).set({ status: "delivered" }).where(eq(s.memos.mandateId, id));
    } else if (to > from) {
      throw new HttpError(409, `Stages advance when agents complete them. Run the pipeline to move to ${PIPELINE[to]!.label}.`);
    } else {
      // moving back re-opens the mandate from that stage
      const { rerunFrom } = await import("@/lib/ai/orchestrator");
      await rerunFrom(id, user.tenantId, status as (typeof PIPELINE)[number]["stage"]);
    }
    await audit(user, `moved mandate to ${status}`, { entityType: "mandate", entityId: id, mandateId: id, detail: { from: m.status, to: status } });
  }
  if (Object.keys(fields).length) {
    await db.update(s.mandates).set(fields).where(eq(s.mandates.id, id));
    await audit(user, "edited mandate", { entityType: "mandate", entityId: id, mandateId: id, detail: { fields: Object.keys(fields) } });
  }
  const [updated] = await db.select().from(s.mandates).where(eq(s.mandates.id, id));
  return NextResponse.json(updated);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["admin", "analyst"]);
  const { id } = await params;
  const db = await getDb();
  const m = await mandateForUser(db, user, id);
  if (m.status === "DELIVERED" && user.role !== "admin") throw new HttpError(403, "Only an administrator can delete a delivered mandate.");
  await db.delete(s.mandates).where(eq(s.mandates.id, id));
  await audit(user, `deleted mandate ${m.reference}`, { entityType: "mandate", entityId: id });
  return new Response(null, { status: 204 });
});
