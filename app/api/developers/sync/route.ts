import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { syncAll } from "@/lib/developers/sync";

export const POST = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  const r = await syncAll(await getDb(), { tenantIds: [user.tenantId] });
  await audit(user, `synced all developer connections (${r.ok} succeeded, ${r.failed} failed)`, { entityType: "developer_connection" });
  return NextResponse.json(r);
});
