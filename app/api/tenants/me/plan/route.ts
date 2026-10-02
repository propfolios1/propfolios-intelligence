import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { subscriptions, tenants } from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, seatUsage } from "@/lib/auth";
import { planById } from "@/lib/plans";
import { getTenantById } from "@/lib/tenant";
import { planInput } from "@/lib/tenant-schemas";

/** Changes the workspace plan. Downgrades are refused while seats or the custom domain exceed the new plan. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { plan: planId } = await parseBody(req, z.object({ plan: planInput }));
  const tenant = (await getTenantById(user.tenantId))!;
  const plan = planById(planId);
  if (tenant.plan === plan.id) return NextResponse.json({ plan: plan.id });
  const { used } = await seatUsage(user.tenantId);
  if (plan.seats !== null && used > plan.seats) throw new HttpError(409, `${used} staff seats are in use; the ${plan.name} plan includes ${plan.seats}. Remove users first.`);
  if (tenant.customDomain && !plan.customDomain) throw new HttpError(409, "Disconnect the custom domain in Branding before leaving the White-label plan.");
  const db = await getDb();
  await db.update(tenants).set({ plan: plan.id, status: "active" }).where(eq(tenants.id, tenant.id));
  const [sub] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenant.id)).orderBy(desc(subscriptions.startedAt)).limit(1);
  if (sub) {
    await db
      .update(subscriptions)
      .set({ plan: plan.id, seats: plan.seats, priceAed: plan.priceAed, status: "active", currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) })
      .where(and(eq(subscriptions.id, sub.id), eq(subscriptions.tenantId, tenant.id)));
  } else {
    await db.insert(subscriptions).values({ tenantId: tenant.id, plan: plan.id, status: "active", seats: plan.seats, priceAed: plan.priceAed, currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) });
  }
  await audit(user, `changed plan from ${planById(tenant.plan).name} to ${plan.name}`, { entityType: "tenant", entityId: tenant.id });
  return NextResponse.json({ plan: plan.id });
});
