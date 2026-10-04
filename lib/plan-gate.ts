import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { tenants } from "@/db/schema";
import { HttpError } from "./auth";
import { MODULE_LABEL, MODULE_MIN_PLAN, planById, planIncludes, type PlanModule } from "./plans";

export async function tenantPlan(tenantId: string) {
  const db = await getDb();
  const [t] = await db.select({ plan: tenants.plan, status: tenants.status }).from(tenants).where(eq(tenants.id, tenantId));
  return t?.plan ?? "starter";
}

/** API routes: 402 unless the firm's plan includes the module. Trials run on the plan they chose. */
export async function requirePlan(user: { tenantId: string; platformAdmin?: boolean }, module: PlanModule) {
  if (user.platformAdmin) return;
  const plan = await tenantPlan(user.tenantId);
  if (!planIncludes(plan, module)) throw new HttpError(402, `${MODULE_LABEL[module]} is included from the ${planById(MODULE_MIN_PLAN[module]).name} plan. Upgrade under Administration, Billing.`);
}
