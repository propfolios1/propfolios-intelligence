import "server-only";

/**
 * Who is on the public site right now: each open page sends a heartbeat
 * every 30 seconds with a random id, and a visitor counts as present for 70
 * seconds after their last one. Uses Upstash Redis or Vercel KV when
 * configured, so every instance sees the same count; otherwise an in-process
 * map, which is exact on a single instance.
 */

const WINDOW_MS = 70_000;
const KEY = "presence:home";
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const g = globalThis as unknown as { __nkPresence?: Map<string, number> };
const memory = (g.__nkPresence ??= new Map());

async function redis(commands: (string | number)[][]) {
  const res = await fetch(`${url}/pipeline`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(commands.map((c) => c.map(String))), cache: "no-store" });
  if (!res.ok) throw new Error(`presence store ${res.status}`);
  return (await res.json()) as { result: unknown }[];
}

export async function heartbeat(id: string | null) {
  const now = Date.now();
  if (url && token) {
    const cmds: (string | number)[][] = [["ZREMRANGEBYSCORE", KEY, 0, now - WINDOW_MS]];
    if (id) cmds.push(["ZADD", KEY, now, id]);
    cmds.push(["ZCARD", KEY], ["PEXPIRE", KEY, WINDOW_MS * 2]);
    const out = await redis(cmds);
    return Number(out[id ? 2 : 1]?.result ?? 0);
  }
  for (const [k, t] of memory) if (t < now - WINDOW_MS) memory.delete(k);
  if (id) memory.set(id, now);
  return memory.size;
}
