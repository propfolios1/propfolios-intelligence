import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { createTemplate, listTemplates } from "@/lib/contracts/service";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const rows = await listTemplates(await getDb(), user.tenantId);
  return NextResponse.json({ templates: rows.map((r) => ({ family: r.family, id: r.current.id, name: r.current.name, jurisdiction: r.current.jurisdiction, status: r.current.status, version: r.current.version, publishedId: r.published?.id ?? null, inputs: r.published?.inputs ?? r.current.inputs })) });
});

const body = z.object({ name: z.string().trim().min(3).max(100), jurisdiction: z.enum(["AE", "IN", "GB", "SG", "ANY"]), fromId: z.string().uuid().nullable().optional() });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, body);
  const t = await createTemplate(await getDb(), user.tenantId, b);
  await audit(user, `created contract template "${t.name}"`, { entityType: "contract_template", entityId: t.id });
  return NextResponse.json({ template: t }, { status: 201 });
});
