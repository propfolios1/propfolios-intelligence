import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { activate, campaignStats, pause } from "@/lib/marketing/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  return NextResponse.json(await campaignStats(await getDb(), user.tenantId, (await params).id));
});

const body = z.object({ action: z.enum(["activate", "pause", "resume"]) });

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { id } = await params;
  const b = await parseBody(req, body);
  const db = await getDb();
  if (b.action === "activate") {
    const r = await activate(db, user.tenantId, id);
    await audit(user, `activated campaign "${r.campaign.name}" (${r.enrolled} leads enrolled)`, { entityType: "campaign", entityId: id });
    return NextResponse.json(r);
  }
  const c = await pause(db, user.tenantId, id, b.action === "pause");
  await audit(user, `${b.action === "pause" ? "paused" : "resumed"} campaign "${c.name}"`, { entityType: "campaign", entityId: id });
  return NextResponse.json({ campaign: c });
});
