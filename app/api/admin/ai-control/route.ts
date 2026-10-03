import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { OS_AGENT_INDEX } from "@/lib/ai/os-agents/registry";

/** Switch OS agents on or off for the firm and set the monthly AI budget. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:ai_control");
  const b = await parseBody(req, z.object({ disabledAgents: z.array(z.string()).max(60).optional(), monthlyBudgetUsd: z.number().min(0).max(100_000).nullable().optional() }));
  const db = await getDb();
  const [t] = await db.select({ cfg: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.id, user.tenantId));
  const prev = t!.cfg.ai ?? { disabledAgents: [], monthlyBudgetUsd: null };
  const next = { disabledAgents: (b.disabledAgents ?? prev.disabledAgents).filter((a) => a in OS_AGENT_INDEX), monthlyBudgetUsd: b.monthlyBudgetUsd === undefined ? prev.monthlyBudgetUsd : b.monthlyBudgetUsd };
  await db.update(s.tenants).set({ configJson: { ...t!.cfg, ai: next } }).where(eq(s.tenants.id, user.tenantId));
  await audit(user, "updated AI control", { entityType: "tenant", entityId: user.tenantId, before: prev, after: next });
  return NextResponse.json(next);
});
