import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { inviteTeammates } from "@/lib/trial/service";

const body = z.object({ emails: z.array(z.string().trim().email().max(200)).min(1).max(3) });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const b = await parseBody(req, body);
  const r = await inviteTeammates(await getDb(), user.tenantId, b.emails, { id: user.id, name: user.name });
  await audit(user, `invited ${r.invited.length} teammates to the trial`);
  return NextResponse.json(r);
});
