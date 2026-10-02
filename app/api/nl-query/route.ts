import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { nlQuery } from "@/lib/ai/agents";
import { enforceRateLimit } from "@/lib/rate-limit";
import { handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { tenantFeatures } from "@/lib/features";

export const maxDuration = 120;

const body = z.object({
  question: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) })).max(40).default([]),
});

/** Streams an assistant answer as newline-delimited JSON (text, tool, sources, done). */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(user, "assistant");
  if (!(await tenantFeatures(user.tenantId)).assistant) throw new HttpError(403, "The assistant is not enabled for this workspace.");
  const { question, history } = await parseBody(req, body);
  const db = await getDb();
  const staff = user.role !== "client";
  let clientName = user.name;
  if (user.clientId) {
    const [c] = await db.select({ name: s.clients.name }).from(s.clients).where(eq(s.clients.id, user.clientId));
    clientName = c?.name ?? clientName;
  }
  const stream = nlQuery({ scope: { db, tenantId: user.tenantId, clientId: user.role === "client" ? user.clientId : null, staff }, clientName, history, question, actor: user.name, signal: req.signal });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
});
