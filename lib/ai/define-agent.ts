import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { appendAudit } from "@/lib/data/store";
import { anthropic, FALLBACK_BETA, MODEL } from "./client";
import { costUsd } from "./pricing";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface AgentContext {
  /** Mandate the run belongs to, for audit scoping. */
  mandateId?: string;
  /** Who triggered the run (user name or "orchestrator"). */
  triggeredBy: string;
  /** Streams raw text deltas as the model writes its JSON output. */
  onDelta?: (text: string) => void;
  signal?: AbortSignal;
}

export interface AgentRunMeta {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  attempts: number;
}

export interface Agent<I extends z.ZodType, O extends z.ZodType> {
  name: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  run(input: z.input<I>, ctx: AgentContext): Promise<z.infer<O>>;
  /** Same as `run`, but also returns token usage and cost. */
  runWithMeta(input: z.input<I>, ctx: AgentContext): Promise<{ output: z.infer<O>; meta: AgentRunMeta }>;
}

export class AgentError extends Error {
  constructor(
    public agent: string,
    message: string,
    public kind: "refusal" | "truncated" | "invalid_output" | "api",
  ) {
    super(`[${agent}] ${message}`);
  }
}

interface AgentSpec<I extends z.ZodType, O extends z.ZodType> {
  name: string;
  description: string;
  inputSchema: I;
  outputSchema: O;
  /** Stable system prompt — kept byte-identical across runs so it caches. */
  system: string;
  /** Renders the validated input into the user turn. */
  prompt: (input: z.infer<I>) => string;
  effort?: Effort;
  maxTokens?: number;
}

const MAX_ATTEMPTS = 2;

/**
 * Builds a production agent: validates input, streams a structured-output
 * request to Claude, validates the result against the output schema (with one
 * corrective retry), and writes cost/usage to the audit log.
 */
export function defineAgent<I extends z.ZodType, O extends z.ZodType>(spec: AgentSpec<I, O>): Agent<I, O> {
  const format = betaZodOutputFormat(spec.outputSchema);

  async function runWithMeta(rawInput: z.input<I>, ctx: AgentContext) {
    const input = spec.inputSchema.parse(rawInput);
    const started = Date.now();
    const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
    let servedBy = MODEL;

    const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: spec.prompt(input) }];

    try {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        const stream = anthropic().beta.messages.stream(
          {
            model: MODEL,
            max_tokens: spec.maxTokens ?? 32_000,
            betas: [FALLBACK_BETA],
            fallbacks: "default",
            thinking: { type: "adaptive" },
            output_config: { effort: spec.effort ?? "high", format },
            cache_control: { type: "ephemeral" },
            system: spec.system,
            messages,
          },
          { signal: ctx.signal },
        );

        if (ctx.onDelta) {
          stream.on("text", (delta) => ctx.onDelta!(delta));
        }

        const message = await stream.finalMessage();
        servedBy = message.model;
        usage.input_tokens += message.usage.input_tokens;
        usage.output_tokens += message.usage.output_tokens;
        usage.cache_read_input_tokens += message.usage.cache_read_input_tokens ?? 0;
        usage.cache_creation_input_tokens += message.usage.cache_creation_input_tokens ?? 0;

        if (message.stop_reason === "refusal") {
          throw new AgentError(spec.name, message.stop_details?.explanation ?? "Request declined.", "refusal");
        }
        if (message.stop_reason === "max_tokens") {
          throw new AgentError(spec.name, "Output hit max_tokens before completing.", "truncated");
        }

        const text = message.content
          .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
          .map((b) => b.text)
          .join("");

        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          json = undefined;
        }
        const parsed = spec.outputSchema.safeParse(json);

        if (parsed.success) {
          const meta: AgentRunMeta = {
            model: servedBy,
            inputTokens: usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens,
            outputTokens: usage.output_tokens,
            costUsd: +costUsd(servedBy, usage).toFixed(4),
            durationMs: Date.now() - started,
            attempts: attempt,
          };
          appendAudit({
            mandateId: ctx.mandateId,
            actor: `${spec.name} agent`,
            actorType: "agent",
            action: spec.description,
            detail: `triggered by ${ctx.triggeredBy}${attempt > 1 ? ` · ${attempt} attempts` : ""}`,
            costUsd: meta.costUsd,
            inputTokens: meta.inputTokens,
            outputTokens: meta.outputTokens,
            durationMs: meta.durationMs,
          });
          return { output: parsed.data, meta };
        }

        if (attempt === MAX_ATTEMPTS) {
          throw new AgentError(spec.name, `Output failed validation: ${z.prettifyError(parsed.error)}`, "invalid_output");
        }
        // Append-only correction turn: keep the prior assistant content intact.
        messages.push({ role: "assistant", content: message.content });
        messages.push({
          role: "user",
          content: `Your previous output did not satisfy the schema:\n${z.prettifyError(parsed.error)}\n\nReturn the complete, corrected JSON object.`,
        });
      }
      throw new AgentError(spec.name, "Exhausted attempts.", "invalid_output");
    } catch (err) {
      const e =
        err instanceof AgentError
          ? err
          : err instanceof Anthropic.APIError
            ? new AgentError(spec.name, `API ${err.status ?? ""} ${err.message}`, "api")
            : new AgentError(spec.name, (err as Error).message, "api");
      appendAudit({
        mandateId: ctx.mandateId,
        actor: `${spec.name} agent`,
        actorType: "agent",
        action: "failed",
        detail: e.message,
        costUsd: +costUsd(servedBy, usage).toFixed(4),
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        durationMs: Date.now() - started,
      });
      throw e;
    }
  }

  return {
    name: spec.name,
    description: spec.description,
    inputSchema: spec.inputSchema,
    outputSchema: spec.outputSchema,
    runWithMeta,
    async run(input, ctx) {
      return (await runWithMeta(input, ctx)).output;
    },
  };
}
