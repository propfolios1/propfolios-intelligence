import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { HttpError, type CurrentUser } from "./auth";
import { APIError } from "@anthropic-ai/sdk";
import { AgentDisabledError } from "./ai/agents/define";
import { DomainError } from "./errors";

/** Wraps a route handler: maps HttpError and Zod errors to JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError || err instanceof DomainError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof z.ZodError) return NextResponse.json({ error: "Some fields are missing or invalid. Correct the highlighted fields and submit again.", issues: z.flattenError(err) }, { status: 422 });
      if (err instanceof AgentDisabledError) return NextResponse.json({ error: err.message }, { status: 409 });
      if (err instanceof APIError && err.status === 429) return NextResponse.json({ error: "Anthropic rate limit reached. Retry in 30 seconds, or move the agent to a lighter model tier in Administration, AI control." }, { status: 429 });
      if (err instanceof APIError && (err.status === 529 || err.status === 503)) return NextResponse.json({ error: "Anthropic is temporarily overloaded. Retry in a minute; completed stages are kept and the run resumes where it stopped." }, { status: 503 });
      if (err instanceof APIError && err.status === 401) return NextResponse.json({ error: "The Anthropic API key was refused. Check ANTHROPIC_API_KEY in Vercel, then redeploy." }, { status: 502 });
      console.error(err);
      return NextResponse.json({ error: "Something went wrong on our side and the change was not saved. Retry; if it happens again, the incident is in the logs under this time." }, { status: 500 });
    }
  };
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const json = await req.json().catch(() => {
    throw new HttpError(400, "Request body must be JSON.");
  });
  return schema.parse(json);
}

/** Request provenance for the audit trail: client address, user agent and a request id (Vercel's, or generated). */
export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null; requestId: string }> {
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
    return { ip, userAgent: h.get("user-agent"), requestId: h.get("x-vercel-id") ?? h.get("x-request-id") ?? crypto.randomUUID() };
  } catch {
    return { ip: null, userAgent: null, requestId: crypto.randomUUID() };
  }
}

/**
 * Records a mutation in the audit log with the actor, the request's address,
 * user agent and id, and before and after snapshots when the caller has them.
 */
export async function audit(
  user: Pick<CurrentUser, "tenantId" | "name"> & { id?: string; impersonating?: boolean },
  action: string,
  extra: { entityType?: string; entityId?: string; mandateId?: string; detail?: unknown; before?: unknown; after?: unknown } = {},
) {
  const db = await getDb();
  const meta = await requestMeta();
  const { before, after, ...rest } = extra;
  await db.insert(auditLogs).values({ tenantId: user.tenantId, userId: user.id ?? null, actorName: user.impersonating ? `${user.name} (Nakhla)` : user.name, actorType: "user", action, ...rest, ip: meta.ip, userAgent: meta.userAgent, requestId: meta.requestId, before: (before ?? null) as never, after: (after ?? null) as never });
}

export const notFoundError = (what = "Resource") => new HttpError(404, `${what} not found.`);
