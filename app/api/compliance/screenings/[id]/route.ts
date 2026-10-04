import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { reviewScreening } from "@/lib/compliance/service";

const body = z.object({ outcome: z.enum(["false_positive", "confirmed_match"]), note: z.string().trim().min(10, "Explain the disposition in a sentence or two.").max(2000) });

export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id } = await params;
  const b = await parseBody(req, body);
  const r = await reviewScreening(await getDb(), user.tenantId, id, { ...b, userId: user.id });
  await audit(user, `dispositioned screening of ${r.after.name} as ${b.outcome.replace("_", " ")}`, { entityType: "aml_screening", entityId: id, before: { status: r.before.status }, after: { status: r.after.status, note: b.note } });
  return NextResponse.json({ screening: r.after });
});
