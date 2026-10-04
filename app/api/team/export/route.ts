import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { ensureHistory, exportCsv, periodOf } from "@/lib/team/metrics";

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const period = new URL(req.url).searchParams.get("period") ?? periodOf();
  if (!/^\d{4}-\d{2}$/.test(period)) throw new HttpError(422, "Period must be YYYY-MM.");
  const db = await getDb();
  await ensureHistory(db, user.tenantId, 1);
  const csv = await exportCsv(db, user.tenantId, period);
  await audit(user, `exported team performance for ${period}`, { entityType: "team" });
  return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="team-performance-${period}.csv"`, "cache-control": "no-store" } });
});
