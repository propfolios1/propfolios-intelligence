import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { DEMO_CLIENT_ID, getClient, getDeveloper, getProperty, holdings, portfolioAlerts } from "@/lib/data/store";
import { anthropic, FALLBACK_BETA, MODEL } from "./client";
import { FIRM_PREAMBLE } from "./agents/_shared";

export interface AssistantSource {
  id: number;
  title: string;
  detail: string;
}

/** Numbered sources the assistant may cite as [n]. */
export function assistantSources(clientId = DEMO_CLIENT_ID): AssistantSource[] {
  const hs = holdings.filter((h) => h.clientId === clientId);
  return [
    ...hs.map((h, i) => {
      const p = getProperty(h.propertyId)!;
      return {
        id: i + 1,
        title: p.name,
        detail: `${p.community} · ${getDeveloper(p.developerId)!.name} · value USD ${(h.valueUsd / 1e6).toFixed(2)}M · IRR ${h.irr}% · cash yield ${h.cashYield}% · ${h.status}`,
      };
    }),
    ...portfolioAlerts
      .filter((a) => a.clientId === clientId)
      .map((a, i) => ({ id: hs.length + i + 1, title: `Alert: ${a.title}`, detail: `${a.severity} · ${a.detail}` })),
  ];
}

export function assistantSystem(clientId = DEMO_CLIENT_ID) {
  const client = getClient(clientId)!;
  const sources = assistantSources(clientId);
  return `${FIRM_PREAMBLE.replace("- Output must be a single JSON object matching the provided schema.", "")}
You are the PropFolios client assistant for ${client.name}. Answer questions about their portfolio, holdings, alerts and the UAE/India markets.

Write in clear prose with short paragraphs; use a list only when comparing several items. When a statement relies on a source below, cite it inline as [n]. If the sources do not contain the answer, say what you would need and offer to ask their analyst. Never give tax or legal advice; refer those to the relevant adviser.

<sources>
${sources.map((s) => `[${s.id}] ${s.title}: ${s.detail}`).join("\n")}
</sources>`;
}

export function streamAssistant(messages: Anthropic.Beta.BetaMessageParam[], signal?: AbortSignal) {
  return anthropic().beta.messages.stream(
    {
      model: MODEL,
      max_tokens: 16_000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      cache_control: { type: "ephemeral" },
      system: assistantSystem(),
      messages,
    },
    { signal },
  );
}
