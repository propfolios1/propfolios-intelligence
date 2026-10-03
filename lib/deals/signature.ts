import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(32).toString("base64url");
export const contentHash = (html: string) => createHash("sha256").update(html).digest("hex");

export const dropboxSignConfigured = () => Boolean(process.env.DROPBOX_SIGN_API_KEY);
export const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, "");

/**
 * Sends a contract through Dropbox Sign. The contract HTML is uploaded as the
 * document; signers receive Dropbox Sign's email. Test mode is on unless
 * DROPBOX_SIGN_TEST_MODE is "0", so a trial key never creates a binding request.
 */
export async function sendViaDropboxSign(c: { title: string; html: string; reference: string; signers: { name: string; email: string }[]; contractId: string }) {
  const key = process.env.DROPBOX_SIGN_API_KEY!;
  const form = new FormData();
  form.set("title", c.title);
  form.set("subject", `${c.title} (${c.reference}) for signature`);
  form.set("message", "Please review and sign. The document was prepared by your adviser.");
  form.set("test_mode", process.env.DROPBOX_SIGN_TEST_MODE === "0" ? "0" : "1");
  form.set("metadata[contract_id]", c.contractId);
  c.signers.forEach((s, i) => {
    form.set(`signers[${i}][email_address]`, s.email);
    form.set(`signers[${i}][name]`, s.name);
    form.set(`signers[${i}][order]`, String(i));
  });
  form.set("files[0]", new Blob([`<!doctype html><html><body style="font-family:Georgia,serif;max-width:720px;margin:40px auto">${c.html}</body></html>`], { type: "text/html" }), `${c.reference}.html`);
  const res = await fetch("https://api.hellosign.com/v3/signature_request/send", { method: "POST", headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` }, body: form });
  const json = (await res.json().catch(() => ({}))) as { signature_request?: { signature_request_id: string; signatures: { signer_email_address: string; signature_id: string }[] }; error?: { error_msg: string } };
  if (!res.ok || !json.signature_request) throw new Error(`Dropbox Sign: ${json.error?.error_msg ?? `HTTP ${res.status}`}`);
  return { requestId: json.signature_request.signature_request_id, signatureIds: Object.fromEntries(json.signature_request.signatures.map((s) => [s.signer_email_address.toLowerCase(), s.signature_id])) };
}

/** Verifies a Dropbox Sign callback: event_hash = HMAC-SHA256(api key, event_time + event_type). */
export function verifyDropboxSignEvent(ev: { event_time: string; event_type: string; event_hash: string }) {
  const key = process.env.DROPBOX_SIGN_API_KEY;
  if (!key) return false;
  const expected = createHmac("sha256", key).update(ev.event_time + ev.event_type).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(ev.event_hash ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}
