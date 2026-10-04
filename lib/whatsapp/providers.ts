import { createHmac, timingSafeEqual } from "node:crypto";
import type { WhatsappProvider } from "@/db/schema-production";
import { IntegrationError, request } from "@/lib/integrations/http";

/**
 * WhatsApp Business through Twilio (Messages and Content APIs) or 360dialog
 * (the Cloud API format at waba-v2.360dialog.io). The sandbox provider
 * records messages without sending them, for rehearsal before a number is
 * approved by Meta.
 */

export type WaCreds = { authToken?: string; apiKey?: string };
export type WaAccount = { provider: WhatsappProvider; phoneNumber: string; accountRef: string | null; creds: WaCreds; statusCallback?: string | null };
export type SendResult = { providerMessageId: string; status: "queued" | "sent" };
export type Media = { type: "image" | "document" | "audio" | "video"; url: string; caption?: string; filename?: string };

const D360 = () => (process.env.D360_BASE_URL || "https://waba-v2.360dialog.io").replace(/\/$/, "");
export const e164 = (p: string) => `+${p.replace(/\D/g, "")}`;
const digits = (p: string) => p.replace(/\D/g, "");

function twilio(acc: WaAccount) {
  if (!acc.accountRef || !acc.creds.authToken) throw new IntegrationError("Twilio", 0, "needs the account SID and auth token.");
  return { base: `https://api.twilio.com/2010-04-01/Accounts/${acc.accountRef}`, auth: `Basic ${Buffer.from(`${acc.accountRef}:${acc.creds.authToken}`).toString("base64")}` };
}

function d360(acc: WaAccount) {
  if (!acc.creds.apiKey) throw new IntegrationError("360dialog", 0, "needs the channel API key.");
  return { "D360-API-KEY": acc.creds.apiKey };
}

let sandboxSeq = 0;
const sandboxId = () => `sbx_${Date.now().toString(36)}${(++sandboxSeq).toString(36)}`;

async function twilioSend(acc: WaAccount, to: string, extra: Record<string, string>): Promise<SendResult> {
  const t = twilio(acc);
  const form: Record<string, string> = { From: `whatsapp:${e164(acc.phoneNumber)}`, To: `whatsapp:${e164(to)}`, ...extra };
  if (acc.statusCallback) form.StatusCallback = acc.statusCallback;
  const r = await request<{ sid: string; status: string }>("Twilio", `${t.base}/Messages.json`, { method: "POST", form, headers: { authorization: t.auth } });
  return { providerMessageId: r.sid, status: r.status === "queued" || r.status === "accepted" ? "queued" : "sent" };
}

async function d360Send(acc: WaAccount, to: string, message: Record<string, unknown>): Promise<SendResult> {
  const r = await request<{ messages?: { id: string }[] }>("360dialog", `${D360()}/messages`, { method: "POST", body: { messaging_product: "whatsapp", recipient_type: "individual", to: digits(to), ...message }, headers: d360(acc) });
  const id = r.messages?.[0]?.id;
  if (!id) throw new IntegrationError("360dialog", 502, "did not return a message ID.");
  return { providerMessageId: id, status: "sent" };
}

export async function sendText(acc: WaAccount, to: string, text: string): Promise<SendResult> {
  if (acc.provider === "sandbox") return { providerMessageId: sandboxId(), status: "sent" };
  if (acc.provider === "twilio") return twilioSend(acc, to, { Body: text });
  return d360Send(acc, to, { type: "text", text: { body: text, preview_url: true } });
}

export async function sendTemplate(acc: WaAccount, to: string, t: { name: string; language: string; providerRef: string | null }, vars: string[]): Promise<SendResult> {
  if (acc.provider === "sandbox") return { providerMessageId: sandboxId(), status: "sent" };
  if (acc.provider === "twilio") {
    if (!t.providerRef) throw new IntegrationError("Twilio", 422, `template ${t.name} has no Content SID; submit it for approval first.`);
    return twilioSend(acc, to, { ContentSid: t.providerRef, ContentVariables: JSON.stringify(Object.fromEntries(vars.map((v, i) => [String(i + 1), v]))) });
  }
  return d360Send(acc, to, { type: "template", template: { name: t.name, language: { code: t.language }, components: vars.length ? [{ type: "body", parameters: vars.map((text) => ({ type: "text", text })) }] : [] } });
}

export async function sendMedia(acc: WaAccount, to: string, m: Media): Promise<SendResult> {
  if (acc.provider === "sandbox") return { providerMessageId: sandboxId(), status: "sent" };
  if (acc.provider === "twilio") return twilioSend(acc, to, { MediaUrl: m.url, ...(m.caption ? { Body: m.caption } : {}) });
  return d360Send(acc, to, { type: m.type, [m.type]: { link: m.url, ...(m.caption && m.type !== "audio" ? { caption: m.caption } : {}), ...(m.filename && m.type === "document" ? { filename: m.filename } : {}) } });
}

/** Submits a template for Meta review through the provider. */
export async function submitTemplate(acc: WaAccount, t: { name: string; category: string; language: string; body: string; variables: string[] }): Promise<{ providerRef: string; status: "submitted" | "approved" }> {
  if (acc.provider === "sandbox") return { providerRef: `sbx_tpl_${t.name}`, status: "approved" };
  if (acc.provider === "twilio") {
    const auth = twilio(acc).auth;
    const c = await request<{ sid: string }>("Twilio", "https://content.twilio.com/v1/Content", { method: "POST", headers: { authorization: auth }, body: { friendly_name: t.name, language: t.language, variables: Object.fromEntries(t.variables.map((v, i) => [String(i + 1), v])), types: { "twilio/text": { body: t.body } } } });
    await request("Twilio", `https://content.twilio.com/v1/Content/${c.sid}/ApprovalRequests/whatsapp`, { method: "POST", headers: { authorization: auth }, body: { name: t.name, category: t.category } });
    return { providerRef: c.sid, status: "submitted" };
  }
  const r = await request<{ id?: string; name?: string }>("360dialog", `${D360()}/v1/configs/templates`, {
    method: "POST",
    headers: d360(acc),
    body: { name: t.name, category: t.category, language: t.language, components: [{ type: "BODY", text: t.body, ...(t.variables.length ? { example: { body_text: [t.variables] } } : {}) }] },
  });
  return { providerRef: r.id ?? t.name, status: "submitted" };
}

export async function templateStatus(acc: WaAccount, t: { name: string; providerRef: string | null }): Promise<{ status: "submitted" | "approved" | "rejected" | "paused"; reason: string | null }> {
  if (acc.provider === "sandbox") return { status: "approved", reason: null };
  const map = (s: string) => (/approved/i.test(s) ? "approved" : /reject/i.test(s) ? "rejected" : /pause|disabled/i.test(s) ? "paused" : "submitted") as "submitted" | "approved" | "rejected" | "paused";
  if (acc.provider === "twilio") {
    const r = await request<{ whatsapp?: { status?: string; rejection_reason?: string } }>("Twilio", `https://content.twilio.com/v1/Content/${t.providerRef}/ApprovalRequests`, { headers: { authorization: twilio(acc).auth } });
    return { status: map(r.whatsapp?.status ?? ""), reason: r.whatsapp?.rejection_reason || null };
  }
  const r = await request<{ waba_templates?: { name: string; status: string; rejected_reason?: string }[] }>("360dialog", `${D360()}/v1/configs/templates`, { headers: d360(acc) });
  const hit = r.waba_templates?.find((x) => x.name === t.name);
  return { status: map(hit?.status ?? ""), reason: hit?.rejected_reason && hit.rejected_reason !== "NONE" ? hit.rejected_reason : null };
}

/** Downloads inbound media with the provider's credentials (media URLs are not public). */
export async function fetchMedia(acc: WaAccount, ref: string): Promise<Response> {
  if (acc.provider === "twilio") return fetch(ref, { headers: { authorization: twilio(acc).auth } });
  if (acc.provider === "360dialog") {
    const meta = await request<{ url: string }>("360dialog", `${D360()}/${encodeURIComponent(ref)}`, { headers: d360(acc) });
    const u = new URL(meta.url);
    return fetch(`${D360()}${u.pathname}${u.search}`, { headers: d360(acc) });
  }
  return new Response("Sandbox media is not stored.", { status: 404 });
}

/** Twilio request signature: HMAC-SHA1 over the full URL and the sorted POST parameters, base64. */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(data).digest("base64");
}

export function verifyTwilio(authToken: string, url: string, params: Record<string, string>, header: string | null) {
  if (!header) return false;
  const want = twilioSignature(authToken, url, params);
  return want.length === header.length && timingSafeEqual(Buffer.from(want), Buffer.from(header));
}

/** Template placeholders {{1}} ... {{n}} must be consecutive, and examples must be given for each. */
export function templateVariables(body: string) {
  const nums = [...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => Number(m[1]));
  const max = nums.length ? Math.max(...nums) : 0;
  const ok = nums.length === 0 || new Set(nums).size === max;
  return { count: max, consecutive: ok };
}

export const renderTemplate = (body: string, vars: string[]) => body.replace(/\{\{(\d+)\}\}/g, (_, n: string) => vars[Number(n) - 1] ?? `{{${n}}}`);
