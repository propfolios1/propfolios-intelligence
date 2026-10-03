import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { reconcileCsv } from "@/lib/commission/service";

/** Bank statement reconciliation: preview matches, or apply them as recorded payments. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const b = await parseBody(req, z.object({ csv: z.string().min(10).max(500_000), apply: z.boolean().default(false) }));
  const r = await reconcileCsv(await getDb(), { tenantId: user.tenantId, name: user.name }, b.csv, b.apply);
  if (b.apply) await audit(user, "reconciled bank statement", { entityType: "reconciliation", after: { matched: r.matched, unmatched: r.unmatched } });
  return NextResponse.json(r);
});
