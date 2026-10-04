import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Portals pull a firm's listing feed from a URL that carries a signed token,
 * so feeds are public to the portal but not enumerable. The token is an HMAC
 * of the workspace and portal under FEED_SECRET (or SETUP_SECRET).
 */
const secret = () => process.env.FEED_SECRET || process.env.SETUP_SECRET || null;

export function feedToken(tenantId: string, portal: string) {
  const k = secret();
  if (!k) return null;
  return createHmac("sha256", k).update(`${tenantId}:${portal}`).digest("base64url").slice(0, 32);
}

export function verifyFeedToken(tenantId: string, portal: string, token: string | null) {
  const want = feedToken(tenantId, portal);
  if (!want || !token || token.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(token));
}

export function feedUrl(base: string, tenantSlug: string, tenantId: string, portal: string) {
  const token = feedToken(tenantId, portal);
  return token ? `${base.replace(/\/$/, "")}/api/feeds/${tenantSlug}/${portal}?token=${token}` : null;
}
