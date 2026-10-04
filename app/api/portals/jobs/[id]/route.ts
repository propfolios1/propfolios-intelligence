import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { retryJob } from "@/lib/portals/service";

export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const job = await retryJob(await getDb(), user.tenantId, (await params).id);
  await audit(user, "retried a portal publish job", { entityType: "portal_publish_job", entityId: job?.id });
  return NextResponse.json({ job });
});
