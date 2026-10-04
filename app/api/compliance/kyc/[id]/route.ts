import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { kycPatch } from "@/lib/compliance/schemas";
import { decideKyc, updateKyc } from "@/lib/compliance/service";

type Ctx = { params: Promise<{ id: string }> };


export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const b = await parseBody(req, kycPatch);
  const k = await updateKyc(await getDb(), user.tenantId, id, b, {});
  await audit(user, `updated due diligence for ${k.name}`, { entityType: "kyc_verification", entityId: id, after: b });
  return NextResponse.json({ verification: k });
});

const decision = z.object({ decision: z.enum(["approved", "rejected"]), note: z.string().trim().min(5).max(2000) });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id } = await params;
  const b = await parseBody(req, decision);
  const k = await decideKyc(await getDb(), user.tenantId, id, { ...b, userId: user.id });
  await audit(user, `${b.decision} due diligence for ${k.name} (${k.riskRating} risk)`, { entityType: "kyc_verification", entityId: id, after: { status: k.status, risk: k.riskRating, factors: k.riskFactors, note: b.note } });
  return NextResponse.json({ verification: k });
});
