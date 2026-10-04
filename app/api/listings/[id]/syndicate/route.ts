import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { syndicate } from "@/lib/brokerage/listings";

const body = z.object({ portals: z.array(z.string().min(2).max(40)).min(1).max(10) });

/** Queues the listing on the chosen portals; the portal picks it up on its next feed pull. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "listings:manage");
  const { id } = await params;
  const b = await parseBody(req, body);
  const r = await syndicate(await getDb(), user.tenantId, id, b.portals);
  await audit(user, "syndicated listing", { entityType: "listing", entityId: id, detail: { portals: b.portals, ...r } });
  return NextResponse.json(r);
});
