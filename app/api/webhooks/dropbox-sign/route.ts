import { getDb } from "@/db";
import { recordProviderSignature } from "@/lib/deals/service";
import { verifyDropboxSignEvent } from "@/lib/deals/signature";

export const dynamic = "force-dynamic";

/**
 * Dropbox Sign callback (set the account callback URL to /api/webhooks/dropbox-sign).
 * Verifies the event hash, records signer status, and must answer with the
 * literal "Hello API Event Received".
 */
export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const raw = form?.get("json");
  const json = typeof raw === "string" ? (JSON.parse(raw) as { event?: { event_time: string; event_type: string; event_hash: string; event_metadata?: { related_signature_id?: string } }; signature_request?: { signature_request_id: string; signatures: { signature_id: string; signer_email_address: string; status_code: string }[] } }) : null;
  if (!json?.event || !verifyDropboxSignEvent(json.event)) return new Response("Invalid event", { status: 401 });
  const sr = json.signature_request;
  if (sr && ["signature_request_signed", "signature_request_declined", "signature_request_viewed", "signature_request_all_signed"].includes(json.event.event_type)) {
    const db = await getDb();
    for (const sig of sr.signatures) {
      const status = sig.status_code === "signed" ? "signed" : sig.status_code === "declined" ? "declined" : json.event.event_type === "signature_request_viewed" && sig.signature_id === json.event.event_metadata?.related_signature_id ? "viewed" : null;
      if (status) await recordProviderSignature(db, sr.signature_request_id, sig.signer_email_address, status);
    }
  }
  return new Response("Hello API Event Received", { headers: { "content-type": "text/plain" } });
}
