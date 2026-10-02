import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { ownsPath, signedUrl } from "@/lib/storage";

/**
 * Opens a stored document. The caller's tenant (and, for clients, their own
 * client record) is checked here; the file itself is served from the private
 * bucket through a signed URL valid for sixty seconds.
 */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, "Document not found.");
  const db = await getDb();
  const [doc] = await db.select().from(s.documents).where(and(eq(s.documents.id, id), eq(s.documents.tenantId, user.tenantId))).limit(1);
  if (!doc || (user.role === "client" && doc.clientId !== user.clientId)) throw new HttpError(404, "Document not found.");
  if (doc.storagePath) {
    if (!ownsPath(doc.storagePath, user.tenantId)) throw new HttpError(404, "Document not found.");
    const url = await signedUrl(doc.storagePath, 60);
    if (!url) throw new HttpError(503, "Document storage is unavailable. Try again shortly.");
    await audit(user, "opened document", { entityType: "document", entityId: doc.id, mandateId: doc.mandateId ?? undefined });
    return NextResponse.redirect(url);
  }
  if (doc.blobUrl) return NextResponse.redirect(doc.blobUrl);
  throw new HttpError(404, "No file is stored for this document.");
});
