import { put } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { embed } from "@/lib/ai/embed";
import { enforceRateLimit } from "@/lib/rate-limit";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { assertClientAccess, listDocuments } from "@/lib/queries";

const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["kyc", "spa", "title_deed", "valuation", "statement", "research", "memo", "other"] as const;
const MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { clientId } = z.object({ clientId: z.uuid().optional() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listDocuments(await getDb(), user, { clientId }));
});

/**
 * Uploads a document (multipart form: file, type, title, clientId?, mandateId?,
 * propertyId?). A mandate or property must belong to the caller's tenant. Files go to
 * Vercel Blob when BLOB_READ_WRITE_TOKEN is set; otherwise the record is kept
 * without a stored file so the flow remains demonstrable.
 */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  await enforceRateLimit(user, "upload");
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Expected a multipart form.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "Attach a file.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "Files must be 10 MB or smaller.");
  if (!MIME.includes(file.type)) throw new HttpError(415, "Upload a PDF, JPEG, PNG or WebP file.");
  const type = z.enum(TYPES).parse(form.get("type") ?? "other");
  const title = z.string().trim().min(1).max(160).parse(form.get("title") || file.name);
  const clientId = user.role === "client" ? user.clientId : z.uuid().nullable().parse(form.get("clientId") || null);
  if (clientId) assertClientAccess(user, clientId);
  const db = await getDb();
  let mandateId: string | null = null;
  let propertyId: string | null = null;
  if (user.role !== "client") {
    mandateId = z.uuid().nullable().parse(form.get("mandateId") || null);
    propertyId = z.uuid().nullable().parse(form.get("propertyId") || null);
    if (mandateId) {
      const [m] = await db.select({ id: s.mandates.id, propertyId: s.mandates.propertyId }).from(s.mandates).where(and(eq(s.mandates.tenantId, user.tenantId), eq(s.mandates.id, mandateId))).limit(1);
      if (!m) throw new HttpError(404, "Mandate not found.");
      propertyId ??= m.propertyId;
    }
    if (propertyId) {
      const [p] = await db.select({ id: s.properties.id }).from(s.properties).where(and(eq(s.properties.tenantId, user.tenantId), eq(s.properties.id, propertyId))).limit(1);
      if (!p) throw new HttpError(404, "Property not found.");
    }
  }
  let blobUrl: string | null = null;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`${user.tenantId}/${clientId ?? mandateId ?? "firm"}/${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`, file, { access: "public", contentType: file.type });
    blobUrl = blob.url;
  }
  const [doc] = await db
    .insert(s.documents)
    .values({ tenantId: user.tenantId, clientId, mandateId, propertyId, title, type, blobUrl, pages: 1, sizeBytes: file.size, contentText: title, embedding: embed(title) })
    .returning({ id: s.documents.id, title: s.documents.title, type: s.documents.type, blobUrl: s.documents.blobUrl, sizeBytes: s.documents.sizeBytes, createdAt: s.documents.createdAt });
  if (type === "kyc" && clientId) await db.update(s.clients).set({ kycStatus: "submitted" }).where(eq(s.clients.id, clientId));
  await audit(user, `uploaded ${type.replace("_", " ")} document`, { entityType: "document", entityId: doc!.id, mandateId: mandateId ?? undefined, detail: { title, stored: Boolean(blobUrl) } });
  return NextResponse.json({ ...doc, stored: Boolean(blobUrl) }, { status: 201 });
});
