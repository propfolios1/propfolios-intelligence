import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { endpointPatch } from "@/lib/webhooks/schemas";
import { deleteEndpoint, endpointSecret, sendTest, updateEndpoint } from "@/lib/webhooks/service";

type Ctx = { params: Promise<{ id: string }> };

async function admin() {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  return { user, db: await getDb() };
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { user, db } = await admin();
  const b = await parseBody(req, endpointPatch);
  const e = await updateEndpoint(db, user.tenantId, id, b);
  await audit(user, `changed webhook endpoint ${e.url}`, { entityType: "webhook_endpoint", entityId: e.id, after: b });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { user, db } = await admin();
  const e = await deleteEndpoint(db, user.tenantId, id);
  await audit(user, `removed webhook endpoint ${e.url}`, { entityType: "webhook_endpoint", entityId: e.id });
  return NextResponse.json({ ok: true });
});

/** test: sends a signed ping now. secret: reveals the signing secret (audited). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { user, db } = await admin();
  const { action } = await parseBody(req, z.object({ action: z.enum(["test", "secret"]) }));
  if (action === "secret") {
    const secret = await endpointSecret(db, user.tenantId, id);
    await audit(user, "revealed a webhook signing secret", { entityType: "webhook_endpoint", entityId: id });
    return NextResponse.json({ secret });
  }
  const d = await sendTest(db, user.tenantId, id);
  return NextResponse.json({ delivery: d });
});
