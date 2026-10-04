import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { subscriptionBody } from "@/lib/market-intel/schemas";
import { createSubscription, generateBrief, listSubscriptions } from "@/lib/market-intel/service";

/** The client's market brief subscriptions. Staff previewing the portal act on the previewed client. */
async function own() {
  const user = await requireApiUser(["client", "tenant_admin", "analyst"]);
  if (!user.clientId) throw new HttpError(403, "No client record is linked to this login.");
  return { user, clientId: user.clientId, db: await getDb() };
}

export const GET = handle(async () => {
  const { user, clientId, db } = await own();
  return NextResponse.json({ subscriptions: await listSubscriptions(db, user.tenantId, clientId) });
});

export const POST = handle(async (req: Request) => {
  const { user, clientId, db } = await own();
  const b = await parseBody(req, subscriptionBody);
  const sub = await createSubscription(db, user.tenantId, clientId, b, { actor: user.id });
  // The first brief is written straight away so the client sees what they subscribed to.
  const report = await generateBrief(db, sub, { deliver: false });
  await audit(user, `subscribed to the market brief "${sub.name}"`, { entityType: "client_market_subscription", entityId: sub.id, after: { filters: sub.filters, frequency: sub.frequency } });
  return NextResponse.json({ subscription: sub, reportId: report.id }, { status: 201 });
});
