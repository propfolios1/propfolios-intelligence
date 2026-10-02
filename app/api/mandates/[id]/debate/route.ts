import { NextResponse } from "next/server";
import { advanceMandate, rerunFrom } from "@/lib/ai/orchestrator";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 300;

/** Re-runs the bull, bear and judge debate (and cross-validation), then the memo. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  await enforceRateLimit(user, "agents");
  const { id } = await params;
  if (!(await rerunFrom(id, user.tenantId, "DEBATE"))) throw new HttpError(404, "Mandate not found.");
  await audit(user, "re-ran debate", { entityType: "mandate", entityId: id, mandateId: id });
  const result = await advanceMandate(id, { tenantId: user.tenantId, actor: user.name });
  return NextResponse.json(result);
});
