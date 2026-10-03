import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";

/** Forget one learned memory: the agent starts again from the firm's records on its next run. */
export const DELETE = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "firm:ai_control");
  const { id } = await params;
  const db = await getDb();
  const [row] = await db.delete(s.agentMemories).where(and(eq(s.agentMemories.tenantId, user.tenantId), eq(s.agentMemories.id, id))).returning();
  if (!row) throw new HttpError(404, "Memory not found.");
  await audit(user, `cleared ${row.agentName} memory (${row.memoryType.replace(/_/g, " ")})`, { entityType: "agent_memory", entityId: row.id, before: row.memory });
  return NextResponse.json({ ok: true });
});
