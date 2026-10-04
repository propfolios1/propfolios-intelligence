import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { addCoachingNote } from "@/lib/team/metrics";
import { requirePlan } from "@/lib/plan-gate";

const body = z.object({ userId: z.string().uuid(), period: z.string().regex(/^\d{4}-\d{2}$/), text: z.string().trim().min(5).max(2000), flag: z.string().max(40).nullable().optional() });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  await requirePlan(user, "team_analytics");
  const b = await parseBody(req, body);
  const r = await addCoachingNote(await getDb(), user.tenantId, b.userId, b.period, { text: b.text, flag: b.flag ?? null, by: user.name });
  await audit(user, "recorded a coaching note", { entityType: "user", entityId: b.userId, after: { period: b.period, flag: b.flag ?? null } });
  return NextResponse.json({ notes: r.notes });
});
