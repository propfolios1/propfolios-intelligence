import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { setSubscription } from "@/lib/bi/service";

/** Subscribe to or cancel a data product for the caller's firm. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin"]);
  const { id } = await params;
  const { active } = await parseBody(req, z.object({ active: z.boolean() }));
  const r = await setSubscription(await getDb(), user.tenantId, id, active);
  await audit(user, active ? "subscribed to data product" : "cancelled data product", { entityType: "data_subscription", entityId: r.id, after: { product: id, status: r.status } });
  return NextResponse.json(r);
});
