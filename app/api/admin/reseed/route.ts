import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { seed } from "@/db/seed";
import { audit, handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const maxDuration = 120;

/** Administrator: wipes and reloads the demonstration dataset. */
export const POST = handle(async () => {
  const user = await requireApiUser(["admin"]);
  const db = await getDb();
  const result = await seed(db, { force: true });
  await audit({ tenantId: user.tenantId, name: user.name }, "reset demonstration data");
  return NextResponse.json(result);
});
