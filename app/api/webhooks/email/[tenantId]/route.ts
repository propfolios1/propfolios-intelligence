import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { verifyFeedToken } from "@/lib/brokerage/feed-token";
import { inboundEmail } from "@/lib/lead-response/service";
import { enforcePublicRateLimit } from "@/lib/rate-limit";

/**
 * Inbound email: replies to the assistant's emails, forwarded by the mail
 * provider's inbound route (Resend, Postmark or SendGrid Inbound Parse, or any
 * forwarder posting JSON). The URL carries a per-firm signed token.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ tenantId: string }> }) => {
  const { tenantId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tenantId) || !verifyFeedToken(tenantId, "email-inbound", new URL(req.url).searchParams.get("token"))) throw new HttpError(401, "Invalid inbound email token.");
  await enforcePublicRateLimit(req, "sign");
  let from = "";
  let text = "";
  let subject: string | null = null;
  let name: string | null = null;
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const f = await req.formData();
    from = String(f.get("from") ?? "");
    text = String(f.get("text") ?? "");
    subject = f.get("subject") ? String(f.get("subject")) : null;
  } else {
    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const d = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>;
    const fromField = d.from ?? d.From ?? d.FromFull;
    from = typeof fromField === "string" ? fromField : Array.isArray(fromField) ? String(fromField[0] ?? "") : typeof fromField === "object" && fromField ? String((fromField as { email?: string; Email?: string }).email ?? (fromField as { Email?: string }).Email ?? "") : "";
    name = typeof d.FromName === "string" ? d.FromName : null;
    text = String(d.text ?? d.TextBody ?? d.StrippedTextReply ?? d.plain ?? "");
    subject = typeof (d.subject ?? d.Subject) === "string" ? String(d.subject ?? d.Subject) : null;
  }
  if (!/@/.test(from) || !text.trim()) throw new HttpError(422, "The email has no sender or no text body.");
  const r = await inboundEmail(await getDb(), tenantId, { from, name, subject, text });
  return NextResponse.json({ ok: true, replied: r.skipped === null });
});
