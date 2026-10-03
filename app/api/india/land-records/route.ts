import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { extractText } from "@/lib/india/extract";
import type { LandRecordKind } from "@/lib/india/parsers";
import { fileLandRecord } from "@/lib/india/service";

export const maxDuration = 120;
const KINDS = ["7_12", "property_card", "form_i_xiv", "escritura"];

/** Uploads (multipart: file) or pastes (multipart or JSON: text) a land record, parses it and files it against a property. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  let propertyId: string | null = null;
  let kind: string | null = null;
  let text = "";
  let method: "text" | "pdf_text" | "ocr" = "text";
  let title: string | undefined;
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const form = await req.formData();
    propertyId = String(form.get("propertyId") ?? "") || null;
    kind = String(form.get("kind") ?? "") || null;
    const file = form.get("file");
    if (file instanceof File && file.size) {
      if (file.size > 10 * 1024 * 1024) throw new HttpError(413, "Files up to 10 MB are accepted.");
      const r = await extractText({ bytes: new Uint8Array(await file.arrayBuffer()), mime: file.type, name: file.name }, { tenantId: user.tenantId, actor: user.name });
      if (!r.text.trim()) throw new HttpError(422, r.note ?? "No text could be read from this file.");
      text = r.text;
      method = r.method;
      title = file.name;
    } else text = String(form.get("text") ?? "");
  } else {
    const j = (await req.json().catch(() => ({}))) as { propertyId?: string; kind?: string; text?: string };
    propertyId = j.propertyId ?? null;
    kind = j.kind ?? null;
    text = j.text ?? "";
  }
  if (!propertyId) throw new HttpError(422, "Choose the property this record belongs to.");
  if (text.trim().length < 40) throw new HttpError(422, "The record text is too short to parse.");
  if (kind && !KINDS.includes(kind)) throw new HttpError(422, "Unknown record type.");
  const result = await fileLandRecord(await getDb(), user, { propertyId, text, kind: (kind as LandRecordKind) || null, method, title });
  await audit(user, "filed land record", { entityType: "land_record", entityId: result.record.id, after: { recordType: result.parsed.recordType, confidence: result.parsed.confidence, warnings: result.parsed.warnings.length } });
  return NextResponse.json({ id: result.record.id, recordType: result.parsed.recordType, parsed: result.parsed.parsed, confidence: result.parsed.confidence, warnings: result.parsed.warnings, missing: result.parsed.missing, method });
});
