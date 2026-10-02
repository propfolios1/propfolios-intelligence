import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { auditLogs } from "@/db/schema";
import { HttpError, type CurrentUser } from "./auth";

/** Wraps a route handler: maps HttpError and Zod errors to JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      if (err instanceof z.ZodError) return NextResponse.json({ error: "Invalid request.", issues: z.flattenError(err) }, { status: 422 });
      console.error(err);
      return NextResponse.json({ error: "Unexpected error. The incident has been logged." }, { status: 500 });
    }
  };
}

export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const json = await req.json().catch(() => {
    throw new HttpError(400, "Request body must be JSON.");
  });
  return schema.parse(json);
}

export async function audit(user: Pick<CurrentUser, "tenantId" | "name"> & { id?: string; impersonating?: boolean }, action: string, extra: { entityType?: string; entityId?: string; mandateId?: string; detail?: unknown } = {}) {
  const db = await getDb();
  await db.insert(auditLogs).values({ tenantId: user.tenantId, userId: user.id ?? null, actorName: user.impersonating ? `${user.name} (Nakhla)` : user.name, actorType: "user", action, ...extra });
}

export const notFoundError = (what = "Resource") => new HttpError(404, `${what} not found.`);
