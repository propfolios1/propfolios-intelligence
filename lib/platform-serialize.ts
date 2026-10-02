import type { PlatformTenant } from "./platform";

export function tenantRows(ts: PlatformTenant[]) {
  return ts.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    brand: t.configJson.brand_name,
    primary: t.configJson.primary_color,
    plan: t.plan,
    status: t.status,
    mrrAed: t.mrrAed,
    staff: t.staff,
    seatLimit: t.seatLimit,
    clients: t.clients,
    mandates: t.mandates,
    aiCost30: t.aiCost30,
    createdAt: t.createdAt.toISOString(),
  }));
}
