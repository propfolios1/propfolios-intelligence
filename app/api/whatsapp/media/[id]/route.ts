import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { mediaFor } from "@/lib/whatsapp/service";

/** Streams inbound media through the firm's provider credentials; provider media URLs are not public. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const res = await mediaFor(await getDb(), user.tenantId, (await params).id);
  return new Response(res.body, { status: res.status, headers: { "content-type": res.headers.get("content-type") ?? "application/octet-stream", "cache-control": "private, max-age=3600" } });
});
