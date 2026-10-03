import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, notFoundError, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { automationBody } from "@/lib/os/automation-schema";
import { matches } from "@/lib/os/automations";
import { scope } from "@/lib/tenant-db";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "automations:manage");
  const { id } = await params;
  const b = await parseBody(req, automationBody.partial());
  const db = await getDb();
  const [before] = await db.select().from(s.automations).where(scope(s.automations, user.tenantId, eq(s.automations.id, id)));
  if (!before) throw notFoundError("Automation");
  const [after] = await db.update(s.automations).set(b).where(eq(s.automations.id, id)).returning();
  await audit(user, b.enabled === false ? "paused automation" : b.enabled === true && Object.keys(b).length === 1 ? "enabled automation" : "updated automation", { entityType: "automation", entityId: id, before, after });
  return NextResponse.json(after);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "automations:manage");
  const { id } = await params;
  const db = await getDb();
  const [before] = await db.delete(s.automations).where(scope(s.automations, user.tenantId, eq(s.automations.id, id))).returning();
  if (!before) throw notFoundError("Automation");
  await audit(user, "deleted automation", { entityType: "automation", entityId: id, before });
  return NextResponse.json({ ok: true });
});

/** Dry run: would the automation match these facts? Nothing is sent. */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const facts = await parseBody(req, z.object({ jurisdiction: z.string().optional(), deal_value_aed: z.number().optional(), client_residency: z.string().optional(), stage: z.string().optional(), deal_type: z.string().optional() }));
  const [a] = await (await getDb()).select().from(s.automations).where(scope(s.automations, user.tenantId, eq(s.automations.id, id)));
  if (!a) throw notFoundError("Automation");
  return NextResponse.json({ matched: matches(a.conditions, { ...facts, label: "Dry run" }), actions: a.actions.map((x) => x.type) });
});
