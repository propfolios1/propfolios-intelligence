import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { mandateForUser } from "@/lib/ai/guard";
import { advanceMandate, PIPELINE, rerunFrom } from "@/lib/ai/orchestrator";
import { audit, handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const maxDuration = 300;

const body = z.object({ from: z.enum(PIPELINE.filter((p) => p.automated).map((p) => p.stage) as [string, ...string[]]).optional() }).default({});

/**
 * Starts (or resumes) the agent pipeline. Returns 202 immediately; work
 * continues after the response and progress is observed on /stream. If the
 * time budget runs out the stream emits "paused" and the client POSTs again.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const db = await getDb();
  const m = await mandateForUser(db, user, id);
  const input = body.parse(await req.json().catch(() => ({})));
  if (input.from) {
    await rerunFrom(m.id, user.tenantId, input.from as (typeof PIPELINE)[number]["stage"]);
    await audit(user, `re-ran pipeline from ${input.from}`, { entityType: "mandate", entityId: m.id, mandateId: m.id });
  } else if (m.status === "INTAKE") {
    await audit(user, "started agent pipeline", { entityType: "mandate", entityId: m.id, mandateId: m.id });
  }
  after(() => advanceMandate(m.id, { tenantId: user.tenantId, actor: user.name, budgetMs: (maxDuration - 25) * 1000 }).catch((e) => console.error("pipeline", e)));
  return NextResponse.json({ accepted: true, mandateId: m.id }, { status: 202 });
});
