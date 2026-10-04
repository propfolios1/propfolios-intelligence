import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { SOCIAL_NETWORKS } from "@/db/schema-production";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { connectSocial, schedulePost } from "@/lib/marketing/service";
import { requirePlan } from "@/lib/plan-gate";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("connect"), network: z.enum(SOCIAL_NETWORKS), mode: z.enum(["live", "sandbox"]), displayName: z.string().trim().min(2).max(80), accountRef: z.string().trim().max(120).nullable().optional(), creds: z.object({ accessToken: z.string().max(4000).optional(), pageId: z.string().max(60).optional(), igUserId: z.string().max(60).optional(), orgUrn: z.string().max(120).optional() }).optional() }),
  z.object({ action: z.literal("schedule"), networks: z.array(z.enum(SOCIAL_NETWORKS)).min(1), caption: z.string().trim().min(1).max(5000), link: z.string().url().nullable().optional(), mediaUrls: z.array(z.string().url()).max(10).default([]), scheduledAt: z.string().datetime(), listingId: z.string().uuid().nullable().optional() }),
]);

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  await requirePlan(user, "marketing");
  const b = await parseBody(req, body);
  const db = await getDb();
  if (b.action === "connect") {
    requirePermission(user, "firm:settings");
    const a = await connectSocial(db, user.tenantId, b);
    await audit(user, `connected ${b.network} (${b.mode})`, { entityType: "social_account", entityId: a.id });
    return NextResponse.json({ account: { id: a.id, network: a.network, mode: a.mode, displayName: a.displayName } });
  }
  const p = await schedulePost(db, user.tenantId, { ...b, scheduledAt: new Date(b.scheduledAt), userId: user.id });
  await audit(user, `scheduled a post on ${b.networks.join(", ")}`, { entityType: "social_post", entityId: p.id });
  return NextResponse.json({ post: p }, { status: 201 });
});
