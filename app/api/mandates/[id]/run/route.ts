import { NextResponse } from "next/server";
import { isAiConfigured } from "@/lib/ai/client";
import { runFullFlow, type FlowEvent } from "@/lib/ai/orchestrator";
import { getMandate } from "@/lib/data/store";

export const maxDuration = 800;

/** Runs the full agent flow and streams progress as newline-delimited JSON. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!getMandate(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isAiConfigured()) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set. Add it to .env.local to run agents." }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const emit = (e: FlowEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      runFullFlow(id, "Analyst", emit, req.signal)
        .catch(() => {
          /* error already emitted */
        })
        .finally(() => controller.close());
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
