import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireApiUser, seatUsage } from "@/lib/auth";
import { getTenantById } from "@/lib/tenant";

/** The current tenant's configuration, plan and seat usage. */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const tenant = await getTenantById(user.tenantId);
  const seats = user.role === "tenant_admin" ? await seatUsage(user.tenantId) : undefined;
  return NextResponse.json({ id: tenant!.id, name: tenant!.name, slug: tenant!.slug, plan: tenant!.plan, status: tenant!.status, config: tenant!.configJson, seats });
});
