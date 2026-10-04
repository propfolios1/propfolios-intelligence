import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { connectionFor, saveFieldMap } from "@/lib/portals/service";

type Ctx = { params: Promise<{ portal: string }> };
const rule = z.object({ target: z.string().min(1).max(120), source: z.string().min(1).max(40), value: z.union([z.string(), z.number(), z.boolean()]).optional(), map: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(), required: z.boolean().optional() });

/** Saves the firm's field map for a portal; null restores the portal default. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const { portal } = await params;
  const b = await parseBody(req, z.object({ rules: z.array(rule).max(80).nullable() }));
  await saveFieldMap(await getDb(), user.tenantId, portal, b.rules);
  await audit(user, `${b.rules ? "edited" : "reset"} the ${portal} field map`, { entityType: "portal_connection" });
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const { portal } = await params;
  const db = await getDb();
  const { row } = await connectionFor(db, user.tenantId, portal);
  await db.update(s.portalConnections).set({ status: "disabled", credentialsEncrypted: null }).where(eq(s.portalConnections.id, row.id));
  await audit(user, `disconnected ${portal}`, { entityType: "portal_connection", entityId: row.id });
  return NextResponse.json({ ok: true });
});
