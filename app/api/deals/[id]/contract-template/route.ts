import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { draftFromTemplate } from "@/lib/contracts/service";

const body = z.object({ templateId: z.string().uuid(), values: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}) });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const b = await parseBody(req, body);
  const r = await draftFromTemplate(await getDb(), user.tenantId, user, { dealId: id, templateId: b.templateId, values: b.values });
  await audit(user, `drafted "${r.contract.title}" version ${r.contract.version} from a template`, { entityType: "deal", entityId: id, after: { contract: r.contract.id, missing: r.missing } });
  return NextResponse.json(r, { status: 201 });
});
