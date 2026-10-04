import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { markRead, sendMessage, setMode, thread } from "@/lib/whatsapp/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const db = await getDb();
  const id = (await params).id;
  await markRead(db, user.tenantId, id);
  return NextResponse.json({ messages: await thread(db, user.tenantId, id) });
});

const send = z.union([
  z.object({ text: z.string().trim().min(1).max(4096) }),
  z.object({ templateId: z.string().uuid(), variables: z.array(z.string().max(200)).max(10) }),
  z.object({ media: z.object({ type: z.enum(["image", "document", "audio", "video"]), url: z.string().url(), caption: z.string().max(1000).optional(), filename: z.string().max(200).optional() }) }),
]);

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  await enforceRateLimit(user, "write");
  const b = await parseBody(req, send);
  const out = "text" in b ? ({ kind: "text", text: b.text } as const) : "templateId" in b ? ({ kind: "template", templateId: b.templateId, variables: b.variables } as const) : ({ kind: "media", media: b.media } as const);
  const msg = await sendMessage(await getDb(), user.tenantId, (await params).id, out, { id: user.id, name: user.name });
  await audit(user, `sent a WhatsApp ${msg.type}`, { entityType: "whatsapp_message", entityId: msg.id });
  return NextResponse.json({ message: msg });
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, z.object({ mode: z.enum(["assistant", "human"]) }));
  const c = await setMode(await getDb(), user.tenantId, (await params).id, b.mode, { id: user.id, name: user.name });
  await audit(user, b.mode === "human" ? "took over a WhatsApp conversation" : "returned a WhatsApp conversation to the assistant", { entityType: "whatsapp_conversation", entityId: c.id });
  return NextResponse.json({ conversation: c });
});
