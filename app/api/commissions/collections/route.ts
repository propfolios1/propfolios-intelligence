import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { runCollectionAgent } from "@/lib/commission/agents";
import { enforceRateLimit } from "@/lib/rate-limit";

export const POST = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  await enforceRateLimit(user, "agents");
  const run = await runCollectionAgent(await getDb(), { tenantId: user.tenantId, name: user.name });
  await audit(user, "ran collection-agent agent", { detail: { costUsd: run.costUsd } });
  return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
});
