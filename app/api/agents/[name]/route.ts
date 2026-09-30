import { NextResponse } from "next/server";
import { z } from "zod";
import { agents, type AgentName } from "@/lib/ai/agents";
import { isAiConfigured } from "@/lib/ai/client";
import { AgentError } from "@/lib/ai/define-agent";

export const maxDuration = 300;

const body = z.object({ input: z.unknown(), mandateId: z.string().optional() });

/** Runs a single agent. Body: { input, mandateId? } → { output, meta }. */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const agent = agents[name as AgentName];
  if (!agent) return NextResponse.json({ error: `Unknown agent "${name}"` }, { status: 404 });
  if (!isAiConfigured()) return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set." }, { status: 503 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Body must be { input, mandateId? }" }, { status: 400 });

  const input = agent.inputSchema.safeParse(parsed.data.input);
  if (!input.success) return NextResponse.json({ error: z.prettifyError(input.error) }, { status: 422 });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (agent.runWithMeta as any)(input.data, { mandateId: parsed.data.mandateId, triggeredBy: "API", signal: req.signal });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AgentError) {
      const status = err.kind === "refusal" ? 422 : err.kind === "api" ? 502 : 500;
      return NextResponse.json({ error: err.message, kind: err.kind }, { status });
    }
    throw err;
  }
}
