import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { subscriptionBody } from "@/lib/market-intel/schemas";
import { deleteSubscription, generateBrief, listSubscriptions, updateSubscription } from "@/lib/market-intel/service";

type Ctx = { params: Promise<{ id: string }> };

async function own() {
  const user = await requireApiUser(["client", "tenant_admin", "analyst"]);
  if (!user.clientId) throw new HttpError(403, "No client record is linked to this login.");
  return { user, clientId: user.clientId, db: await getDb() };
}

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { user, clientId, db } = await own();
  const b = await parseBody(req, subscriptionBody.partial());
  const sub = await updateSubscription(db, user.tenantId, clientId, id, b);
  await audit(user, `updated the market brief "${sub.name}"`, { entityType: "client_market_subscription", entityId: sub.id, detail: b });
  return NextResponse.json({ subscription: sub });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { user, clientId, db } = await own();
  const sub = await deleteSubscription(db, user.tenantId, clientId, id);
  await audit(user, `stopped the market brief "${sub.name}"`, { entityType: "client_market_subscription", entityId: sub.id });
  return NextResponse.json({ ok: true });
});

/** Writes the brief now, outside the schedule. */
export const POST = handle(async (_req: Request, { params }: Ctx) => {
  const { id } = await params;
  const { user, clientId, db } = await own();
  const sub = (await listSubscriptions(db, user.tenantId, clientId)).find((x) => x.id === id);
  if (!sub) throw new HttpError(404, "Subscription not found.");
  const report = await generateBrief(db, sub);
  await audit(user, `requested the market brief "${sub.name}"`, { entityType: "client_report", entityId: report.id });
  return NextResponse.json({ reportId: report.id });
});
