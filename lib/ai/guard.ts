import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { HttpError, type CurrentUser } from "@/lib/auth";

/** Loads a mandate within the caller's tenant; clients may only load their own. */
export async function mandateForUser(db: DB, user: CurrentUser, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Mandate not found.");
  const [m] = await db
    .select()
    .from(s.mandates)
    .where(and(eq(s.mandates.id, id), eq(s.mandates.tenantId, user.tenantId)))
    .limit(1);
  if (!m || (user.role === "client" && m.clientId !== user.clientId)) throw new HttpError(404, "Mandate not found.");
  return m;
}
