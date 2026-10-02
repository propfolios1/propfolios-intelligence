import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { addUsage, costUsd, emptyUsage, type Usage } from "./cost";

/** Deep work (pipeline agents) and fast work (chat, monitoring). Override with env vars. */
export const MODELS = {
  primary: process.env.ANTHROPIC_MODEL_PRIMARY || "claude-sonnet-4-20250514",
  fast: process.env.ANTHROPIC_MODEL_FAST || "claude-haiku-4-5",
};

export const isAiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | undefined;
export function anthropic() {
  client ??= new Anthropic({ maxRetries: 3, timeout: 5 * 60_000 });
  return client;
}

/** Newer models reject forced tool_choice; they get "auto" plus an explicit instruction. */
export function supportsForcedTool(model: string) {
  return !/^claude-(fable|mythos|opus-5|sonnet-5)/.test(model);
}

export interface AgentContext {
  tenantId: string;
  mandateId?: string | null;
  actor: string;
  signal?: AbortSignal;
  /** Called with the running size of the streamed tool input, for live progress. */
  onProgress?: (chars: number) => void;
}

export interface AgentRun<T> {
  output: T;
  model: string;
  usage: Usage;
  costUsd: number;
  durationMs: number;
  attempts: number;
  replay: boolean;
}

export class AgentError extends Error {
  constructor(
    public agent: string,
    message: string,
    public kind: "refusal" | "truncated" | "invalid_output" | "api" | "not_configured",
  ) {
    super(`[${agent}] ${message}`);
  }
}

export function toolSchema(schema: z.ZodType): Anthropic.Tool.InputSchema {
  const json = z.toJSONSchema(schema, { target: "draft-7", unrepresentable: "any" }) as Record<string, unknown>;
  delete json.$schema;
  return json as Anthropic.Tool.InputSchema;
}

export async function recordAgentRun(ctx: AgentContext, agent: string, action: string, run: { model: string; usage: Usage; costUsd: number; durationMs: number }, detail?: unknown) {
  try {
    const db = await getDb();
    await db.insert(auditLogs).values({
      tenantId: ctx.tenantId,
      actorName: `${agent} agent`,
      actorType: "agent",
      action,
      entityType: ctx.mandateId ? "mandate" : null,
      entityId: ctx.mandateId ?? null,
      mandateId: ctx.mandateId ?? null,
      model: run.model,
      inputTokens: run.usage.input_tokens + (run.usage.cache_read_input_tokens ?? 0) + (run.usage.cache_creation_input_tokens ?? 0),
      outputTokens: run.usage.output_tokens,
      costUsd: +run.costUsd.toFixed(5),
      durationMs: run.durationMs,
      detail: detail as object,
    });
  } catch (e) {
    console.error("audit write failed", e);
  }
}

/**
 * Structured output via tool calling. Streams the request (live progress via
 * the partial tool input), validates the tool input with Zod, and on failure
 * returns the validation error as an is_error tool_result and asks again
 * (up to three attempts). Cost and tokens are written to audit_logs.
 */
export async function runStructured<T extends z.ZodType>(opts: {
  agent: string;
  action: string;
  model?: string;
  system: string;
  user: string;
  schema: T;
  toolName: string;
  toolDescription: string;
  maxTokens?: number;
  ctx: AgentContext;
}): Promise<AgentRun<z.infer<T>>> {
  if (!isAiConfigured()) throw new AgentError(opts.agent, "ANTHROPIC_API_KEY is not set.", "not_configured");
  const model = opts.model ?? MODELS.primary;
  const forced = supportsForcedTool(model);
  const tool: Anthropic.Tool = { name: opts.toolName, description: opts.toolDescription, input_schema: toolSchema(opts.schema) };
  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: forced ? opts.system : `${opts.system}\n\nRespond only by calling the ${opts.toolName} tool with the complete result.`,
      cache_control: { type: "ephemeral" },
    },
  ];
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.user }];
  const started = Date.now();
  let usage = emptyUsage();
  let lastModel = model;

  for (let attempt = 1; attempt <= 3; attempt++) {
    let message: Anthropic.Message;
    try {
      const stream = anthropic().messages.stream(
        {
          model,
          max_tokens: opts.maxTokens ?? 16_000,
          system,
          tools: [tool],
          tool_choice: forced ? { type: "tool", name: opts.toolName } : { type: "auto" },
          messages,
        },
        { signal: opts.ctx.signal },
      );
      if (opts.ctx.onProgress) {
        let chars = 0;
        stream.on("inputJson", (delta) => {
          chars += delta.length;
          opts.ctx.onProgress!(chars);
        });
      }
      message = await stream.finalMessage();
    } catch (err) {
      const e = err instanceof Anthropic.APIError ? new AgentError(opts.agent, `Anthropic API ${err.status ?? "network"}: ${err.message}`, "api") : new AgentError(opts.agent, (err as Error).message, "api");
      await recordAgentRun(opts.ctx, opts.agent, "failed", { model, usage, costUsd: costUsd(model, usage), durationMs: Date.now() - started }, { error: e.message });
      throw e;
    }
    lastModel = message.model;
    usage = addUsage(usage, message.usage);

    if (message.stop_reason === "refusal") throw new AgentError(opts.agent, "The model declined this request.", "refusal");
    if (message.stop_reason === "max_tokens") throw new AgentError(opts.agent, "Output exceeded the token limit.", "truncated");

    const block = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === opts.toolName);
    const parsed = opts.schema.safeParse(block?.input);
    if (block && parsed.success) {
      const run = { model: lastModel, usage, costUsd: costUsd(lastModel, usage), durationMs: Date.now() - started };
      await recordAgentRun(opts.ctx, opts.agent, opts.action, run, { attempts: attempt });
      return { output: parsed.data, ...run, attempts: attempt, replay: false };
    }
    if (attempt === 3) {
      const why = block ? z.prettifyError(parsed.error!) : "No tool call returned.";
      await recordAgentRun(opts.ctx, opts.agent, "failed validation", { model: lastModel, usage, costUsd: costUsd(lastModel, usage), durationMs: Date.now() - started }, { error: why });
      throw new AgentError(opts.agent, `Output failed validation after 3 attempts: ${why}`, "invalid_output");
    }
    messages.push({ role: "assistant", content: message.content });
    messages.push({
      role: "user",
      content: block
        ? [{ type: "tool_result", tool_use_id: block.id, is_error: true, content: `Schema validation failed:\n${z.prettifyError(parsed.error!)}\nCall ${opts.toolName} again with a corrected, complete input.` }]
        : `Call the ${opts.toolName} tool with the complete result.`,
    });
  }
  throw new AgentError(opts.agent, "Exhausted attempts.", "invalid_output");
}
