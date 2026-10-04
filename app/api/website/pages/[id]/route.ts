import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { deletePage, savePage } from "@/lib/website/service";

type Ctx = { params: Promise<{ id: string }> };
const body = z.object({ title: z.string().trim().min(2).max(60).optional(), blocks: z.array(z.object({ type: z.string(), content: z.record(z.string(), z.unknown()) })).max(30).optional() });

/** Saves a page's draft. Block content is validated per block type; publishing makes it live. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, body);
  try {
    const page = await savePage(await getDb(), user.tenantId, (await params).id, b);
    return NextResponse.json({ page });
  } catch (e) {
    if (e instanceof z.ZodError) throw new HttpError(422, `A block is incomplete: ${e.issues[0]?.path.join(".")} ${e.issues[0]?.message ?? ""}`.trim());
    throw e;
  }
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  await deletePage(await getDb(), user.tenantId, (await params).id);
  return NextResponse.json({ ok: true });
});
