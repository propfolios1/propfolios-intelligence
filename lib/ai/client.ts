import "server-only";
import Anthropic from "@anthropic-ai/sdk";

/** Default model for every agent and the client assistant. */
export const MODEL = "claude-opus-5-5";

/**
 * Server-side refusal fallback: if a safety classifier declines, the API re-runs
 * the request on a fallback model inside the same call.
 */
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | undefined;

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export function anthropic() {
  client ??= new Anthropic();
  return client;
}
