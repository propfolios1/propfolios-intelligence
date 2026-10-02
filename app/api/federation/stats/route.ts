import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { federationStats, tenantContribution } from "@/lib/federation";
import { getTenantById } from "@/lib/tenant";

/** "Learnings from N deals across M advisories", plus this firm's own participation. */
export const GET = handle(async () => {
  const user = await requireApiUser();
  const db = await getDb();
  const [stats, tenant, contributed] = await Promise.all([federationStats(db), getTenantById(user.tenantId), user.role === "client" ? 0 : tenantContribution(db, user.tenantId)]);
  return NextResponse.json({ ...stats, consent: tenant?.consentFederation ?? false, contributed });
});
