import { NextResponse } from "next/server";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { OS_AGENT_INDEX } from "@/lib/ai/os-agents/registry";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 120;

/** Runs any OS agent on its representative sample input: the AI control page's test run. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ agent: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "platform_admin"]);
  requirePermission(user, "firm:ai_control");
  await enforceRateLimit(user, "agents");
  const { agent } = await params;
  const a = OS_AGENT_INDEX[agent];
  if (!a) throw new HttpError(404, `Unknown agent "${agent}".`);
  const run = await a.run(a.sample, { tenantId: user.tenantId, actor: `${user.name} (test run)` });
  await audit(user, `test-ran ${agent} agent`, { detail: { costUsd: run.costUsd } });
  return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
});
