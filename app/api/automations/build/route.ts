import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { AUTOMATION_VOCAB, automationBuilder } from "@/lib/ai/os-agents/fabric";
import { enforceRateLimit } from "@/lib/rate-limit";

/** The automation builder turns a sentence into a draft automation; nothing is saved until the user confirms. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "automations:manage");
  await enforceRateLimit(user, "agents");
  const { request } = await parseBody(req, z.object({ request: z.string().min(10).max(600) }));
  await getDb();
  const run = await automationBuilder.run({ request, ...AUTOMATION_VOCAB }, { tenantId: user.tenantId, actor: user.name });
  await audit(user, "ran automation-builder agent", { detail: { costUsd: run.costUsd } });
  return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
});
