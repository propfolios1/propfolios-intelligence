import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { renameDemoTenants } from "@/db/seed-tenants";

export const dynamic = "force-dynamic";

/**
 * One-time rename of demonstration tenants created by earlier releases.
 * Disabled unless DEMO_RENAME_ENABLED=true, and authorised by SETUP_SECRET.
 * Each decision, renamed or not, is written to that tenant's audit log.
 * POST /api/migrate/rename-demo-tenants  (header x-setup-secret)
 */
export async function POST(req: Request) {
  if (process.env.DEMO_RENAME_ENABLED !== "true") return NextResponse.json({ ok: false, error: "Disabled. Set DEMO_RENAME_ENABLED=true for the one run, then remove it." }, { status: 403 });
  const secret = process.env.SETUP_SECRET;
  if (!secret || req.headers.get("x-setup-secret") !== secret) return NextResponse.json({ ok: false, error: "Invalid setup secret." }, { status: 401 });
  const db = await getDb();
  const outcomes = await renameDemoTenants(db);
  if (outcomes.length)
    await db.insert(s.auditLogs).values(outcomes.map((o) => ({ tenantId: o.tenantId, actorName: "Platform migration", actorType: "system" as const, action: o.renamed ? `renamed demonstration tenant from ${o.from} to ${o.to}` : `kept tenant name ${o.from}: ${o.reason}`, entityType: "tenant", entityId: o.tenantId })));
  return NextResponse.json({ ok: true, outcomes });
}
