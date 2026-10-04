import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { sendCampaign } from "@/lib/brokerage/marketing";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "marketing:send");
  await enforceRateLimit(user, "write");
  const { id } = await params;
  const r = await sendCampaign(await getDb(), user.tenantId, id);
  await audit(user, "sent campaign", { entityType: "campaign", entityId: id, detail: r });
  return NextResponse.json(r);
});
