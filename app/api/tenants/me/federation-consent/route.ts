import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { backfillLearnings, withdrawLearnings } from "@/lib/federation";

/**
 * Opt in or out of the federation. Opting in contributes every delivered
 * mandate's anonymised learning; opting out removes all of them.
 */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { consent } = await parseBody(req, z.object({ consent: z.boolean() }));
  const db = await getDb();
  await db.update(s.tenants).set({ consentFederation: consent }).where(eq(s.tenants.id, user.tenantId));
  const changed = consent ? await backfillLearnings(db, user.tenantId) : await withdrawLearnings(db, user.tenantId);
  await audit(user, consent ? "opted in to federated intelligence" : "opted out of federated intelligence", { entityType: "tenant", entityId: user.tenantId, detail: { learnings: changed } });
  return NextResponse.json({ consent, [consent ? "contributed" : "withdrawn"]: changed });
});
