// Supabase Edge Function runtime (Deno). Shared by every scheduled job.
//
// pg_cron calls the function through pg_net with the service role key. The
// function verifies that key, then relays the run to the Nakhla application
// at NAKHLA_APP_URL/api/jobs/<job>, authorised by NAKHLA_JOBS_SECRET, where
// the job runs against the database and is recorded in job_runs. Retries on
// network errors and 5xx use exponential backoff; the Idempotency-Key (job
// plus scheduled minute) makes a retried call return the first run instead of
// running twice. Every attempt is logged as one JSON line.

type Json = Record<string, unknown>;

const json = (body: Json, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const log = (entry: Json) => console.log(JSON.stringify({ at: new Date().toISOString(), ...entry }));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function relay(job: string) {
  Deno.serve(async (req: Request) => {
    if (req.method !== "POST") return json({ ok: false, error: "Use POST." }, 405);
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const auth = req.headers.get("authorization") ?? "";
    if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
      log({ job, level: "error", event: "unauthorised" });
      return json({ ok: false, error: "Unauthorised." }, 401);
    }
    const app = Deno.env.get("NAKHLA_APP_URL")?.replace(/\/$/, "");
    const secret = Deno.env.get("NAKHLA_JOBS_SECRET");
    if (!app || !secret) {
      log({ job, level: "error", event: "not_configured" });
      return json({ ok: false, error: "Set NAKHLA_APP_URL and NAKHLA_JOBS_SECRET in the function secrets." }, 500);
    }
    let input: Json = {};
    try {
      input = (await req.json()) as Json;
    } catch {
      input = {};
    }
    const scheduled = typeof input.scheduled_at === "string" ? input.scheduled_at : new Date().toISOString();
    const idempotencyKey = `${job}:${scheduled.slice(0, 16)}`;
    const params = (input.params ?? {}) as Json;
    let last: { status: number; body: Json } = { status: 0, body: {} };
    for (let attempt = 1; attempt <= 3; attempt++) {
      const started = Date.now();
      try {
        const res = await fetch(`${app}/api/jobs/${job}`, {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${secret}`, "idempotency-key": idempotencyKey },
          body: JSON.stringify({ params }),
          signal: AbortSignal.timeout(290_000),
        });
        const body = (await res.json().catch(() => ({}))) as Json;
        last = { status: res.status, body };
        log({ job, attempt, status: res.status, ms: Date.now() - started, ok: res.ok });
        if (res.ok || res.status < 500) break;
      } catch (e) {
        last = { status: 0, body: { error: e instanceof Error ? e.message : String(e) } };
        log({ job, attempt, level: "error", error: last.body.error, ms: Date.now() - started });
      }
      if (attempt < 3) await sleep(1000 * 2 ** attempt);
    }
    const ok = last.status >= 200 && last.status < 300;
    return json({ ok, job, idempotencyKey, upstreamStatus: last.status, result: last.body }, ok ? 200 : 502);
  });
}
