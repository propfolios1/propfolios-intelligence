import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { sanitiseMemoHtml } from "@/lib/ai/agents/memo";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { getMemo } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser();
  const { id } = await params;
  return NextResponse.json(await getMemo(await getDb(), user, id));
});

const patch = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  contentHtml: z.string().max(200_000).optional(),
  keyMetrics: z.array(z.object({ label: z.string().max(40), value: z.string().max(40) })).max(8).optional(),
  status: z.enum(["draft", "in_review"]).optional(),
  /** Optimistic concurrency: the version the editor started from. */
  version: z.number().int().optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const db = await getDb();
  const row = await getMemo(db, user, id);
  const input = await parseBody(req, patch);
  if (row.memo.status === "delivered") throw new HttpError(409, "Delivered memos are locked. Re-open the mandate to revise.");
  if (input.version !== undefined && input.version !== row.memo.version) throw new HttpError(409, `This memo was updated by ${row.memo.lastEditedBy ?? "another user"}. Reload to see the latest version.`);
  const [updated] = await db
    .update(s.memos)
    .set({
      ...(input.title && { title: input.title }),
      ...(input.contentHtml !== undefined && { contentHtml: sanitiseMemoHtml(input.contentHtml) }),
      ...(input.keyMetrics && { keyMetrics: input.keyMetrics }),
      ...(input.status && { status: input.status }),
      // editing an approved memo returns it to review
      ...(row.memo.status === "approved" && { status: "in_review" as const, approvedAt: null, approvedBy: null }),
      lastEditedBy: user.name,
      version: sql`${s.memos.version} + 1`,
    })
    .where(eq(s.memos.id, id))
    .returning();
  await audit(user, "edited memo", { entityType: "memo", entityId: id, mandateId: row.mandate.id, detail: { version: updated!.version } });
  return NextResponse.json(updated);
});
