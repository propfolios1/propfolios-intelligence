import "server-only";
import { HttpError, type CurrentUser } from "./auth";

/**
 * Fixed-window rate limiting per user per tenant. Uses Upstash Redis or
 * Vercel KV over REST when configured (shared across instances); otherwise an
 * in-process window, which is adequate for a single instance and for demos.
 */

const LIMITS = {
  agents: { limit: 30, windowSec: 60 },
  assistant: { limit: 20, windowSec: 60 },
  upload: { limit: 20, windowSec: 60 },
  write: { limit: 120, windowSec: 60 },
  sign: { limit: 10, windowSec: 60 },
} as const;
export type Bucket = keyof typeof LIMITS;

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const g = globalThis as unknown as { __pfRate?: Map<string, { count: number; reset: number }> };
const memory = (g.__pfRate ??= new Map());

async function hit(key: string, windowSec: number): Promise<number> {
  if (url && token) {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSec), "NX"],
      ]),
      cache: "no-store",
    });
    if (res.ok) {
      const json = (await res.json()) as { result: number }[];
      return Number(json[0]?.result ?? 0);
    }
  }
  const now = Date.now();
  const cur = memory.get(key);
  if (!cur || cur.reset < now) {
    memory.set(key, { count: 1, reset: now + windowSec * 1000 });
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

export async function enforceRateLimit(user: Pick<CurrentUser, "id" | "tenantId">, bucket: Bucket) {
  const { limit, windowSec } = LIMITS[bucket];
  const window = Math.floor(Date.now() / (windowSec * 1000));
  const count = await hit(`rl:${user.tenantId}:${user.id}:${bucket}:${window}`, windowSec);
  if (count > limit) throw new HttpError(429, `Rate limit reached: ${limit} requests per minute for this action. Retry shortly.`);
}

/** Unauthenticated endpoints (public signing): limited per client address. */
export async function enforcePublicRateLimit(req: Request, bucket: Bucket) {
  const { limit, windowSec } = LIMITS[bucket];
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const window = Math.floor(Date.now() / (windowSec * 1000));
  const count = await hit(`rl:public:${ip}:${bucket}:${window}`, windowSec);
  if (count > limit) throw new HttpError(429, "Too many attempts. Retry in a minute.");
}
