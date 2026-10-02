import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { subscriptions, tenants } from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { tenantDetail } from "@/lib/platform";
import { planById } from "@/lib/plans";
import { getTenantById } from "@/lib/tenant";
import { planInput } from "@/lib/tenant-schemas";

type Ctx = { params: Promise<{ id: string }> };

async function requirePlatform() {
  const user = await requireApiUser();
  if (!user.platformAdmin) throw new HttpError(403, "Platform administrators only.");
  return user;
}

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  await requirePlatform();
  const { id } = await params;
  const d = /^[0-9a-f-]{36}$/i.test(id) ? await tenantDetail(await getDb(), id) : null;
  if (!d) throw new HttpError(404, "Tenant not found.");
  return NextResponse.json(d);
});

const patch = z.object({
  status: z.enum(["trial", "active", "suspended", "cancelled"]).optional(),
  plan: planInput.optional(),
  features: z.object({ assistant: z.boolean(), clientPortal: z.boolean(), marketTiming: z.boolean(), crossBorder: z.boolean() }).optional(),
});

/** Platform controls: status (suspend, reactivate, cancel), plan and feature flags. */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requirePlatform();
  const { id } = await params;
  const tenant = /^[0-9a-f-]{36}$/i.test(id) ? await getTenantById(id) : null;
  if (!tenant || tenant.configJson.platform) throw new HttpError(404, "Tenant not found.");
  const input = await parseBody(req, patch);
  const db = await getDb();
  const set: Partial<typeof tenants.$inferInsert> = {};
  if (input.status) set.status = input.status;
  if (input.plan) set.plan = input.plan;
  if (input.features) set.configJson = { ...tenant.configJson, features: input.features };
  await db.update(tenants).set(set).where(eq(tenants.id, tenant.id));
  if (input.plan || input.status) {
    const plan = planById(input.plan ?? tenant.plan);
    await db
      .update(subscriptions)
      .set({
        plan: plan.id,
        seats: plan.seats,
        priceAed: plan.priceAed,
        ...(input.status === "cancelled" ? { status: "cancelled" as const, cancelledAt: new Date() } : input.status === "active" ? { status: "active" as const, cancelledAt: null } : {}),
      })
      .where(eq(subscriptions.tenantId, tenant.id));
  }
  const changes = [input.status && `status ${input.status}`, input.plan && `plan ${planById(input.plan).name}`, input.features && "feature flags"].filter(Boolean).join(", ");
  await audit({ tenantId: tenant.id, name: `${user.name} (Nakhla)`, id: user.id }, `platform updated ${changes}`, { entityType: "tenant", entityId: tenant.id });
  return NextResponse.json({ ok: true });
});
