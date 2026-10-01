import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { embed } from "@/lib/ai/embed";
import { markDelivered } from "@/lib/ai/orchestrator";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { getMemo } from "@/lib/queries";

const body = z.object({ deliver: z.boolean().default(true) }).default({ deliver: true });

/**
 * Investment committee approval. Approving locks the memo; delivering also
 * moves the mandate to DELIVERED, files the memo in the client's documents
 * and notifies the client in their message thread.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["admin", "analyst"]);
  const { id } = await params;
  const { deliver } = body.parse(await req.json().catch(() => ({})));
  const db = await getDb();
  const row = await getMemo(db, user, id);
  if (row.memo.status === "delivered") throw new HttpError(409, "This memo has already been delivered.");
  if (row.memo.lastEditedBy === user.name && user.role !== "admin" && row.memo.lastEditedBy !== "Memo agent") {
    throw new HttpError(403, "The memo's last editor cannot approve it. Ask a second reviewer or an administrator.");
  }
  const now = new Date();
  await db.update(s.memos).set({ status: deliver ? "delivered" : "approved", approvedBy: user.name, approvedAt: now }).where(eq(s.memos.id, id));
  await audit(user, deliver ? "approved and delivered memo" : "approved memo", { entityType: "memo", entityId: id, mandateId: row.mandate.id });
  if (deliver) {
    if (row.mandate.status === "REVIEW") await markDelivered(db, row.mandate.id, user.name);
    const text = row.memo.contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    await db.insert(s.documents).values({
      tenantId: user.tenantId,
      clientId: row.mandate.clientId,
      mandateId: row.mandate.id,
      title: row.memo.title,
      type: "memo",
      pages: Math.max(2, Math.ceil(text.length / 3200)),
      sizeBytes: Math.round(text.length * 1.6),
      contentText: text,
      embedding: embed(`${row.memo.title}\n${text}`),
    });
    await db.insert(s.messages).values({
      tenantId: user.tenantId,
      clientId: row.mandate.clientId,
      authorName: user.name,
      authorRole: user.role === "admin" ? "admin" : "analyst",
      body: `${row.memo.title} has been approved by the investment committee and is now in your Documents.`,
    });
  }
  const [updated] = await db.select().from(s.memos).where(eq(s.memos.id, id));
  return NextResponse.json(updated);
});
