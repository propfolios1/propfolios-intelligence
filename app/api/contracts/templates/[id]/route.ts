import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { editTemplate, getTemplate, publishTemplate } from "@/lib/contracts/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  return NextResponse.json(await getTemplate(await getDb(), user.tenantId, (await params).id));
});

const input = z.object({ path: z.string().regex(/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)*$/), label: z.string().trim().min(2).max(80), type: z.enum(["text", "number", "date", "boolean"]), default: z.union([z.string().max(500), z.number(), z.boolean()]).optional() });
const patch = z.object({ name: z.string().trim().min(3).max(100).optional(), description: z.string().trim().max(500).optional(), body: z.string().min(20).max(100_000).optional(), inputs: z.array(input).max(30).optional() });

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, patch);
  const t = await editTemplate(await getDb(), user.tenantId, (await params).id, b);
  await audit(user, `edited contract template "${t.name}" (draft version ${t.version})`, { entityType: "contract_template", entityId: t.id });
  return NextResponse.json({ template: t });
});

const publish = z.object({ note: z.string().trim().min(5).max(500) });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, publish);
  const t = await publishTemplate(await getDb(), user.tenantId, (await params).id, { note: b.note, userId: user.id });
  await audit(user, `published contract template "${t.name}" version ${t.version}`, { entityType: "contract_template", entityId: t.id, after: { note: b.note } });
  return NextResponse.json({ template: t });
});
