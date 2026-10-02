import { and, eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { listInsights, refreshIfStale, scanTenant } from "@/lib/insights";
import { enforceRateLimit } from "@/lib/rate-limit";

/** The proactive intelligence feed. Rescans in the background when new data has arrived. */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const db = await getDb();
  after(() => refreshIfStale(db, user.tenantId).then(() => undefined, (e: Error) => console.error("insight refresh failed", e)));
  return NextResponse.json(await listInsights(db, user));
});

/** Staff: run the insight agent for this workspace now. */
export const POST = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  await enforceRateLimit(user, "agents");
  const db = await getDb();
  const result = await scanTenant(db, user.tenantId, { actor: user.name });
  await audit(user, "ran insight scan", { entityType: "tenant", entityId: user.tenantId, detail: result });
  return NextResponse.json(result);
});

/** Mark read or dismiss. Clients may act only on their own client-facing insights. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { id, status } = await parseBody(req, z.object({ id: z.uuid(), status: z.enum(["read", "dismissed", "new"]) }));
  const db = await getDb();
  const [row] = await db.select().from(s.insights).where(and(eq(s.insights.id, id), eq(s.insights.tenantId, user.tenantId))).limit(1);
  if (!row || (user.role === "client" && (row.clientId !== user.clientId || row.audience === "analyst"))) throw new HttpError(404, "Insight not found.");
  const [updated] = await db.update(s.insights).set({ status }).where(eq(s.insights.id, id)).returning();
  if (status === "dismissed") await audit(user, "dismissed insight", { entityType: "insight", entityId: id, detail: { title: row.title } });
  return NextResponse.json(updated);
});
