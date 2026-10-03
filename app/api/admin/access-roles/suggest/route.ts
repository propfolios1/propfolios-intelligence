import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { permissionSuggester } from "@/lib/ai/os-agents/fabric";

/** The permission suggester reads a user's last 90 days of audited actions and refusals. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:users");
  const { userId } = await parseBody(req, z.object({ userId: z.string().uuid() }));
  const db = await getDb();
  const [u] = await db.select().from(s.users).where(and(eq(s.users.tenantId, user.tenantId), eq(s.users.id, userId)));
  if (!u) throw new HttpError(404, "User not found.");
  const rows = await db.select({ action: s.auditLogs.action }).from(s.auditLogs).where(and(eq(s.auditLogs.tenantId, user.tenantId), eq(s.auditLogs.userId, userId), gte(s.auditLogs.createdAt, new Date(Date.now() - 90 * 86_400_000))));
  const count = (xs: string[]) => Object.entries(xs.reduce<Record<string, number>>((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {})).map(([action, c]) => ({ action, count: c })).sort((a, b) => b.count - a.count).slice(0, 15);
  const run = await permissionSuggester.run({ userId, name: u.name, title: u.title, currentRole: u.accessRole ?? u.role, activity: count(rows.filter((r) => !r.action.startsWith("refused:")).map((r) => r.action)), refused: count(rows.filter((r) => r.action.startsWith("refused:")).map((r) => r.action.replace("refused: ", ""))) }, { tenantId: user.tenantId, actor: user.name });
  await audit(user, "ran permission-suggester agent", { entityType: "user", entityId: userId, detail: { costUsd: run.costUsd } });
  return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
});
