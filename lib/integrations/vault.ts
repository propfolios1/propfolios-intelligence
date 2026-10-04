import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Credentials for third-party systems (CRM tokens, portal keys, WhatsApp
 * tokens, SSO certificates) are stored encrypted with AES-256-GCM. The key is
 * NAKHLA_ENCRYPTION_KEY (32 bytes, base64 or hex) or, failing that, derived
 * from SETUP_SECRET. Ciphertext format: v1.<iv>.<tag>.<data>, base64url.
 */
function key(): Buffer {
  const raw = process.env.NAKHLA_ENCRYPTION_KEY;
  if (raw) {
    const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
    if (buf.length === 32) return buf;
  }
  const seed = process.env.SETUP_SECRET || process.env.CLERK_SECRET_KEY || "nakhla-demonstration-vault";
  return createHash("sha256").update(`nakhla-vault:${seed}`).digest();
}

export function seal(plain: string | Record<string, unknown>): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(typeof plain === "string" ? plain : JSON.stringify(plain), "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
}

export function open(sealed: string): string {
  const [v, iv, tag, data] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || data === undefined) throw new Error("Unrecognised credential format.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}

export function openJson<T>(sealed: string | null | undefined): T | null {
  if (!sealed) return null;
  try {
    return JSON.parse(open(sealed)) as T;
  } catch {
    return null;
  }
}

/** Shows the last four characters of a secret, never more. */
export const mask = (secret: string | null | undefined) => (secret ? `•••• ${secret.slice(-4)}` : "Not set");

/** Signed, expiring state for OAuth redirects and magic links: payload.expiry.signature. */
export function signState(payload: Record<string, string>, ttlSec = 600): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  const sig = createHmac("sha256", key()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyState<T extends Record<string, string>>(state: string | null): T | null {
  if (!state) return null;
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const want = createHmac("sha256", key()).update(body).digest("base64url");
  if (want.length !== sig.length || !timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
  if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
  return parsed;
}
