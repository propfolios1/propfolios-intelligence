import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { submitForApproval } from "@/lib/whatsapp/service";

/** Submits the template to Meta through the provider for review. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "marketing:send");
  const t = await submitForApproval(await getDb(), user.tenantId, (await params).id);
  await audit(user, `submitted WhatsApp template ${t.name} for approval`, { entityType: "whatsapp_template", entityId: t.id });
  return NextResponse.json({ template: t });
});
