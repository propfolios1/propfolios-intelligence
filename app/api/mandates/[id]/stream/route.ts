import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { subscribe, type FlowEvent } from "@/lib/ai/events";
import { mandateForUser } from "@/lib/ai/guard";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Server-sent events for a mandate's pipeline. The database is the source of
 * truth (polled each second, so any instance can serve the stream); in-process
 * bus events add token-level progress when the run shares this instance.
 */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const db = await getDb();
  await mandateForUser(db, user, id);

  const enc = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const unsubscribe = subscribe(id, (e: FlowEvent) => {
        if (e.type === "progress" || e.type === "paused" || e.type === "error") send(e.type, e);
      });
      let last = "";
      const started = Date.now();
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", close);
      while (!closed && Date.now() - started < (maxDuration - 10) * 1000) {
        const [m] = await db
          .select({ status: s.mandates.status, timeline: s.mandates.timeline, totalCostUsd: s.mandates.totalCostUsd, runningSince: s.mandates.runningSince, recommendation: s.mandates.recommendation, riskRating: s.mandates.riskRating })
          .from(s.mandates)
          .where(eq(s.mandates.id, id));
        if (!m) break;
        const snapshot = JSON.stringify(m);
        if (snapshot !== last) {
          last = snapshot;
          send("snapshot", { ...m, running: Boolean(m.runningSince) });
        } else {
          controller.enqueue(enc.encode(`: keep-alive\n\n`));
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      send("end", {});
      close();
    },
    cancel() {
      closed = true;
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
});
