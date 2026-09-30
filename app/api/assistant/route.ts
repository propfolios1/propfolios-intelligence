import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assistantSources, streamAssistant } from "@/lib/ai/assistant";
import { isAiConfigured } from "@/lib/ai/client";

export const maxDuration = 300;

const body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(20_000) })).min(1).max(60),
});

const DEMO_REPLY = `Your portfolio is concentrated in prime Dubai residential, which has carried most of this year's performance. Most holdings are marked above cost, and one ready asset is now trading comfortably ahead of its base-case exit value [2].

Two items deserve attention. First, the developer on one off-plan asset has requested a seven-month handover extension, which pushes rental income into 2028 [10]. Second, the escrow audit on another off-plan position shows a shortfall against reported construction progress [13]. Your analyst has booked a site inspection.

If helpful, I can compare a partial exit from that holding against the Saadiyat opportunity currently on your shortlist.`;

type Event = { type: "sources"; sources: ReturnType<typeof assistantSources> } | { type: "delta"; text: string } | { type: "done" } | { type: "error"; message: string };

/** Streams the assistant reply as newline-delimited JSON events. */
export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid messages" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Event) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      send({ type: "sources", sources: assistantSources() });
      try {
        if (!isAiConfigured()) {
          // Demo mode: replay a canned answer at a natural reading cadence.
          for (const token of DEMO_REPLY.match(/\S+\s*/g) ?? []) {
            if (req.signal.aborted) break;
            send({ type: "delta", text: token });
            await new Promise((r) => setTimeout(r, 28));
          }
        } else {
          const s = streamAssistant(parsed.data.messages, req.signal);
          s.on("text", (text) => send({ type: "delta", text }));
          const final = await s.finalMessage();
          if (final.stop_reason === "refusal") send({ type: "error", message: "The assistant can't help with that request." });
        }
        send({ type: "done" });
      } catch (err) {
        const message = err instanceof Anthropic.APIError ? `Assistant unavailable (${err.status ?? "network"}).` : "Assistant unavailable.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
