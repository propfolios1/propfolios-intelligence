import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { assertClientAccess } from "@/lib/queries";

/** Acknowledge an alert. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { id, acknowledged } = await parseBody(req, z.object({ id: z.uuid(), acknowledged: z.boolean() }));
  const db = await getDb();
  const [a] = await db.select().from(s.alerts).where(and(eq(s.alerts.id, id), eq(s.alerts.tenantId, user.tenantId)));
  if (!a) throw new HttpError(404, "Alert not found.");
  assertClientAccess(user, a.clientId);
  const [updated] = await db.update(s.alerts).set({ acknowledged }).where(eq(s.alerts.id, id)).returning();
  await audit(user, acknowledged ? "acknowledged alert" : "re-opened alert", { entityType: "alert", entityId: id, detail: { title: a.title } });
  return NextResponse.json(updated);
});
