import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { campaignWriter } from "@/lib/ai/os-agents/brokerage";
import { SEGMENTS, segmentMembers } from "@/lib/brokerage/marketing";
import { permitLabel } from "@/lib/markets";
import { enforceRateLimit } from "@/lib/rate-limit";
import { scope } from "@/lib/tenant-db";

export const maxDuration = 120;

const body = z.object({
  channel: z.enum(["email", "social", "portal_boost", "print"]),
  brief: z.string().trim().min(5).max(1000),
  segment: z.enum(Object.keys(SEGMENTS) as [keyof typeof SEGMENTS, ...(keyof typeof SEGMENTS)[]]),
  listingId: z.string().uuid().nullable().optional(),
});

/** Drafts campaign copy with the campaign writer; nothing is sent. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "listings:manage");
  await enforceRateLimit(user, "agents");
  const b = await parseBody(req, body);
  const db = await getDb();
  const [members, [l], [t]] = await Promise.all([
    segmentMembers(db, user.tenantId, b.segment),
    b.listingId ? db.select().from(s.listings).where(scope(s.listings, user.tenantId, eq(s.listings.id, b.listingId))) : Promise.resolve([] as (typeof s.listings.$inferSelect)[]),
    db.select({ name: s.tenants.name }).from(s.tenants).where(eq(s.tenants.id, user.tenantId)),
  ]);
  const run = await campaignWriter.run(
    { firm: t?.name ?? "The firm", channel: b.channel, brief: b.brief, segment: { label: SEGMENTS[b.segment].label, size: members.length }, listing: l ? { title: l.title, community: l.community, price: l.price, currency: l.currency, permitNumber: l.permitNumber, permitLabel: permitLabel(l.market, l.city) } : null },
    { tenantId: user.tenantId, actor: user.name },
  );
  await audit(user, "ran campaign writer", { entityType: "campaign", detail: { costUsd: run.costUsd } });
  return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
});
