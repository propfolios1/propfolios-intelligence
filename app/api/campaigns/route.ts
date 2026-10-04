import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { SEGMENTS } from "@/lib/brokerage/marketing";

const body = z.object({
  name: z.string().trim().min(3).max(140),
  channel: z.enum(["email", "social", "portal_boost", "print"]),
  segment: z.enum(Object.keys(SEGMENTS) as [keyof typeof SEGMENTS, ...(keyof typeof SEGMENTS)[]]),
  listingId: z.string().uuid().nullable().optional(),
  subject: z.string().trim().max(120).nullable().optional(),
  body: z.string().max(10000).default(""),
  bodySource: z.enum(["manual", "ai"]).default("manual"),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "listings:manage");
  const b = await parseBody(req, body);
  const [c] = await (await getDb()).insert(s.campaigns).values({ tenantId: user.tenantId, ...b, createdBy: user.id }).returning();
  await audit(user, "created campaign", { entityType: "campaign", entityId: c!.id });
  return NextResponse.json({ id: c!.id }, { status: 201 });
});
