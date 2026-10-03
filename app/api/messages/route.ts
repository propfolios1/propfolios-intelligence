import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, type CurrentUser } from "@/lib/auth";
import { notifyMentions } from "@/lib/os/notify";
import { assertClientAccess, listMessages } from "@/lib/queries";

function resolveClient(user: CurrentUser, clientId?: string) {
  const id = user.role === "client" ? user.clientId : clientId;
  if (!id) throw new HttpError(422, "clientId is required.");
  assertClientAccess(user, id);
  return id;
}

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { clientId } = z.object({ clientId: z.uuid().optional() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listMessages(await getDb(), user, resolveClient(user, clientId)));
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const input = await parseBody(req, z.object({ clientId: z.uuid().optional(), body: z.string().trim().min(1).max(4000) }));
  const clientId = resolveClient(user, input.clientId);
  const db = await getDb();
  const [m] = await db.insert(s.messages).values({ tenantId: user.tenantId, clientId, authorName: user.name, authorRole: user.role, body: input.body }).returning();
  if (input.body.includes("@")) await notifyMentions(db, { tenantId: user.tenantId, text: input.body, author: user.name, href: `/analyst/clients/${clientId}`, context: "Client conversation" });
  return NextResponse.json(m, { status: 201 });
});
