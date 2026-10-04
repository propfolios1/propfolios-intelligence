import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { requestPublish } from "@/lib/portals/service";
import { PORTAL_KEYS } from "@/lib/portals/specs";
import { enforceRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;
const body = z.object({ portals: z.array(z.enum(PORTAL_KEYS as [string, ...string[]])).min(1).max(8), action: z.enum(["publish", "unpublish"]) });

/** One-click publish or removal on the chosen portals; each result is returned per portal. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "listings:manage");
  await enforceRateLimit(user, "write");
  const { id } = await params;
  const b = await parseBody(req, body);
  const results = await requestPublish(await getDb(), user.tenantId, id, b.portals, b.action, { id: user.id, name: user.name });
  await audit(user, `${b.action === "publish" ? "published" : "removed"} listing on ${b.portals.join(", ")}`, { entityType: "listing", entityId: id, detail: results });
  return NextResponse.json({ results });
});
