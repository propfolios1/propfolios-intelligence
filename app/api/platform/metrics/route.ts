import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { federationStats } from "@/lib/federation";
import { platformDashboard, platformMetrics } from "@/lib/platform";

/** Platform-wide revenue, AI quality and cost metrics. */
export const GET = handle(async () => {
  const user = await requireApiUser(["platform_admin", "tenant_admin"]);
  if (!user.platformAdmin || user.impersonating) throw new HttpError(403, "Platform administrators only.");
  const db = await getDb();
  const [dashboard, metrics, federation] = await Promise.all([platformDashboard(db), platformMetrics(db), federationStats(db)]);
  return NextResponse.json({ dashboard, metrics, federation });
});
