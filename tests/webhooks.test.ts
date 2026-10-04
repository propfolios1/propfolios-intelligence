import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { testDb } from "./helpers/pglite";

describe("outbound webhooks", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let w: typeof import("@/lib/webhooks/service");
  beforeAll(async () => {
    env = await testDb();
    w = await import("@/lib/webhooks/service");
  });

  it("signs payloads the way receivers verify them", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const header = w.sign("whsec_test", body, 1_790_000_000);
    expect(header).toMatch(/^t=1790000000,v1=[0-9a-f]{64}$/);
    expect(w.verify("whsec_test", body, header, 300, 1_790_000_100_000)).toBe(true);
    expect(w.verify("whsec_test", body + " ", header, 300, 1_790_000_100_000)).toBe(false);
    expect(w.verify("whsec_other", body, header, 300, 1_790_000_100_000)).toBe(false);
    expect(w.verify("whsec_test", body, header, 300, 1_790_001_000_000)).toBe(false);
  });

  it("rejects plain HTTP, private addresses and unknown events", async () => {
    await expect(w.createEndpoint(env.db, env.a.id, { url: "http://hooks.example.com/x", events: ["deal.closed"] }, null)).rejects.toThrow(/HTTPS/);
    await expect(w.createEndpoint(env.db, env.a.id, { url: "https://127.0.0.1/x", events: ["deal.closed"] }, null)).rejects.toThrow(/public internet/);
    await expect(w.createEndpoint(env.db, env.a.id, { url: "https://10.0.0.5/x", events: ["deal.closed"] }, null)).rejects.toThrow(/public internet/);
    await expect(w.createEndpoint(env.db, env.a.id, { url: "https://hooks.example.com/x", events: ["deal.exploded"] }, null)).rejects.toThrow(/Choose at least one event/);
  });

  it("queues subscribed events, delivers them signed, and retries failures with backoff", async () => {
    const { endpoint, secret } = await w.createEndpoint(env.db, env.a.id, { url: "https://hooks.example.com/nakhla", events: ["lead.created", "deal.closed"] }, env.ua.id);
    expect(secret).toMatch(/^whsec_/);
    expect(await w.endpointSecret(env.db, env.a.id, endpoint.id)).toBe(secret);
    await expect(w.endpointSecret(env.db, env.b.id, endpoint.id)).rejects.toThrow(/not found/);
    // A lead created through the normal path is queued.
    const { createLead } = await import("@/lib/brokerage/leads");
    await createLead(env.db, env.a.id, { name: "Sara Haddad", email: "sara@example.com", source: "website", market: "AE", intent: "buy" }, { name: "Website" });
    expect(await w.enqueue(env.db, env.a.id, "invoice.paid", { x: 1 })).toBe(0);
    expect(await w.enqueue(env.db, env.b.id, "deal.closed", { x: 1 })).toBe(0);
    const received: { headers: Headers; body: string }[] = [];
    let status = 500;
    const fetcher = (async (_url: string, init: RequestInit) => {
      received.push({ headers: new Headers(init.headers), body: String(init.body) });
      return new Response(null, { status });
    }) as unknown as typeof fetch;
    const t0 = new Date(Math.ceil((Date.now() + 5_000) / 1000) * 1000);
    const at = (sec: number) => new Date(t0.getTime() + sec * 1000);
    expect(await w.dispatchWebhooks(env.db, { now: t0, fetcher })).toMatchObject({ due: 1, delivered: 0 });
    const [d1] = await env.db.select().from(s.webhookDeliveries).where(eq(s.webhookDeliveries.endpointId, endpoint.id));
    expect(d1).toMatchObject({ status: "pending", attempts: 1, responseStatus: 500, error: "HTTP 500" });
    expect(d1!.nextAttemptAt.getTime()).toBe(at(60).getTime());
    // Not due yet; then due and delivered.
    expect((await w.dispatchWebhooks(env.db, { now: at(30), fetcher })).due).toBe(0);
    status = 204;
    expect(await w.dispatchWebhooks(env.db, { now: at(65), fetcher })).toMatchObject({ due: 1, delivered: 1 });
    const last = received[received.length - 1]!;
    const body = JSON.parse(last.body);
    expect(body).toMatchObject({ type: "lead.created", tenant_id: env.a.id, data: { name: "Sara Haddad", email: "sara@example.com" } });
    expect(last.headers.get("nakhla-event")).toBe("lead.created");
    expect(w.verify(secret, last.body, last.headers.get("nakhla-signature"), 300, at(65).getTime())).toBe(true);
  });

  it("gives up after six attempts and switches off an endpoint that keeps failing", async () => {
    const { endpoint } = await w.createEndpoint(env.db, env.a.id, { url: "https://down.example.com/hook", events: ["deal.closed"] }, null);
    const fetcher = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    await w.enqueue(env.db, env.a.id, "deal.closed", { deal_id: "d1" }, new Date("2026-10-05T00:00:00Z"));
    let now = new Date("2026-10-05T00:00:00Z");
    for (let i = 0; i < 6; i++) {
      await w.dispatchWebhooks(env.db, { now, fetcher });
      now = new Date(now.getTime() + 13 * 3_600_000);
    }
    const [d] = await env.db.select().from(s.webhookDeliveries).where(eq(s.webhookDeliveries.endpointId, endpoint.id));
    expect(d).toMatchObject({ status: "failed", attempts: 6, error: "ECONNREFUSED" });
    for (let i = 0; i < 14; i++) await w.sendTest(env.db, env.a.id, endpoint.id, fetcher);
    const [e] = await env.db.select().from(s.webhookEndpoints).where(eq(s.webhookEndpoints.id, endpoint.id));
    expect(e).toMatchObject({ active: false, consecutiveFailures: 20 });
    expect(e!.disabledReason).toMatch(/Switched off after 20 failed deliveries/);
    // Resuming resets the failure count.
    expect(await w.updateEndpoint(env.db, env.a.id, endpoint.id, { active: true })).toMatchObject({ active: true, consecutiveFailures: 0, disabledReason: null });
  });
});
