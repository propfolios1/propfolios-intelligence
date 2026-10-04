import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { convertTrial, restoreTrial } from "@/lib/trial/service";

const body = z.discriminatedUnion("action", [z.object({ action: z.literal("restore") }), z.object({ action: z.literal("convert"), plan: z.enum(["starter", "professional", "enterprise", "white_label"]), reference: z.string().max(120).optional() })]);

/** Support actions on a trial: restore a soft-deleted workspace, or convert one paid by invoice. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ tenantId: string }> }) => {
  const user = await requireApiUser();
  if (!user.platformAdmin) throw new HttpError(403, "Platform administrators only.");
  const { tenantId } = await params;
  const b = await parseBody(req, body);
  const db = await getDb();
  if (b.action === "restore") await restoreTrial(db, tenantId, user.name);
  else await convertTrial(db, tenantId, b.plan, user.name, b.reference ?? "Invoice");
  return NextResponse.json({ ok: true });
});
