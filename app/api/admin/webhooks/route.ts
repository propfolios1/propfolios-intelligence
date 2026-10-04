import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { endpointBody } from "@/lib/webhooks/schemas";
import { createEndpoint, webhookView } from "@/lib/webhooks/service";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const v = await webhookView(await getDb(), user.tenantId);
  return NextResponse.json({ endpoints: v.endpoints.map((e) => ({ id: e.id, url: e.url, description: e.description, events: e.events, active: e.active, consecutiveFailures: e.consecutiveFailures, lastDeliveryAt: e.lastDeliveryAt, disabledReason: e.disabledReason, createdAt: e.createdAt })), deliveries: v.deliveries });
});

/** Registers an endpoint. The signing secret is returned once here and can be revealed again by an administrator. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, endpointBody);
  const { endpoint, secret } = await createEndpoint(await getDb(), user.tenantId, b, user.id);
  await audit(user, `added webhook endpoint ${endpoint.url}`, { entityType: "webhook_endpoint", entityId: endpoint.id, after: { url: endpoint.url, events: endpoint.events } });
  return NextResponse.json({ id: endpoint.id, secret }, { status: 201 });
});
