import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { campaignSchema } from "@/lib/marketing/schemas";
import { activate, createCampaign } from "@/lib/marketing/service";

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, campaignSchema);
  const db = await getDb();
  const c = await createCampaign(db, user.tenantId, { ...b, userId: user.id });
  const act = b.activate ? await activate(db, user.tenantId, c.id) : null;
  await audit(user, `created ${b.kind.replace("_", " ")} campaign "${c.name}"${act ? `, activated with ${act.enrolled} leads` : ""}`, { entityType: "campaign", entityId: c.id });
  return NextResponse.json({ campaign: act?.campaign ?? c, enrolled: act?.enrolled ?? 0 }, { status: 201 });
});
