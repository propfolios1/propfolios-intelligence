import { NextResponse } from "next/server";
import { AGENTS } from "@/lib/ai/agents";
import { AgentError } from "@/lib/ai/client";
import { enforceRateLimit } from "@/lib/rate-limit";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";

export const maxDuration = 300;

/** Invokes one agent directly with a validated input. Staff only. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ agent: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  await enforceRateLimit(user, "agents");
  const { agent } = await params;
  const entry = AGENTS[agent];
  if (!entry) throw new HttpError(404, `Unknown agent "${agent}".`);
  const input = await parseBody(req, entry.input);
  try {
    const run = await entry.run(input as never, { tenantId: user.tenantId, actor: user.name, signal: req.signal });
    await audit(user, `invoked ${agent} agent`, { detail: { costUsd: run.costUsd, replay: run.replay } });
    return NextResponse.json(run);
  } catch (err) {
    if (err instanceof AgentError) return NextResponse.json({ error: err.message, kind: err.kind }, { status: err.kind === "invalid_output" ? 502 : 503 });
    throw err;
  }
});
