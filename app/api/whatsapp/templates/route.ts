import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { createTemplate } from "@/lib/whatsapp/service";

const body = z.object({ name: z.string().trim().min(2).max(60), category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]), language: z.string().min(2).max(10), body: z.string().trim().min(5).max(1024), variables: z.array(z.string().max(100)).max(10) });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "marketing:send");
  const t = await createTemplate(await getDb(), user.tenantId, await parseBody(req, body));
  await audit(user, `created WhatsApp template ${t.name}`, { entityType: "whatsapp_template", entityId: t.id });
  return NextResponse.json({ template: t }, { status: 201 });
});
