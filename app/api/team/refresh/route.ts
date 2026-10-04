import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { snapshot } from "@/lib/team/metrics";
import { requirePlan } from "@/lib/plan-gate";

const body = z.object({ period: z.string().regex(/^\d{4}-\d{2}$/) });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  await requirePlan(user, "team_analytics");
  const b = await parseBody(req, body);
  const r = await snapshot(await getDb(), user.tenantId, b.period);
  await audit(user, `recomputed team performance for ${b.period}`, { entityType: "team" });
  return NextResponse.json(r);
});
