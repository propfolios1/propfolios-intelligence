import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { aggregateFederation } from "@/lib/federation";

/** Platform administrators: run the federation aggregation now. */
export const POST = handle(async () => {
  const user = await requireApiUser(["platform_admin", "tenant_admin"]);
  if (!user.platformAdmin || user.impersonating) throw new HttpError(403, "Platform administrators only.");
  return NextResponse.json(await aggregateFederation(await getDb(), user.name), { status: 201 });
});
