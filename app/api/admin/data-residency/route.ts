import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { platformTenantId, requireApiUser, requirePermission } from "@/lib/auth";
import { notify } from "@/lib/os/notify";
import { acknowledgeSubprocessors, cancelMove, requestMove, residency } from "@/lib/enterprise/residency";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  return NextResponse.json({ residency: await residency(await getDb(), user.tenantId) });
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const db = await getDb();
  const b = await parseBody(req, z.discriminatedUnion("action", [z.object({ action: z.literal("request"), region: z.string().max(40), reason: z.string().max(1000).default("") }), z.object({ action: z.literal("cancel") }), z.object({ action: z.literal("acknowledge") })]));
  if (b.action === "request") {
    const { row, target } = await requestMove(db, user.tenantId, b, user.id);
    await audit(user, `requested a move of the firm's data to ${target.label}`, { entityType: "data_residency", entityId: row.id, after: { region: target.key, reason: b.reason } });
    const pid = await platformTenantId();
    if (pid) await notify(db, { tenantId: pid, roles: ["tenant_admin"], category: "system", title: `Data residency request: ${target.label}`, body: `A firm has asked to move its data to ${target.label}. ${b.reason}`.trim(), href: "/platform/tenants", priority: "high" }).catch(() => undefined);
    return NextResponse.json({ residency: row });
  }
  const row = b.action === "cancel" ? await cancelMove(db, user.tenantId) : await acknowledgeSubprocessors(db, user.tenantId);
  await audit(user, b.action === "cancel" ? "withdrew the data residency request" : "acknowledged the sub-processor list", { entityType: "data_residency", entityId: row.id });
  return NextResponse.json({ residency: row });
});
