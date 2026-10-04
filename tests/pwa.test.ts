import { createRequire } from "node:module";
import path from "node:path";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import manifest from "@/app/manifest";
import { testDb } from "./helpers/pglite";

const policy = createRequire(import.meta.url)(path.resolve(import.meta.dirname, "../public/sw-policy.js")) as {
  SHELL: string[];
  classify: (method: string, url: string) => string;
  overflow: <T>(keys: T[], limit: number) => T[];
  notification: (p: unknown) => { title: string; options: { body: string; tag: string; data: { href: string } } };
};

describe("installable app", () => {
  it("declares a standalone app that opens on the agent dashboard, with 192 and 512 icons", () => {
    const m = manifest();
    expect(m).toMatchObject({ start_url: "/m/dashboard", display: "standalone", theme_color: "#0A1F44" });
    expect(m.icons!.map((i) => i.sizes)).toEqual(["192x192", "512x512", "512x512"]);
    expect(m.icons!.some((i) => i.purpose === "maskable")).toBe(true);
  });
});

describe("service worker policy", () => {
  it("caches the six agent screens and the offline page in the shell", () => {
    for (const p of ["/m/dashboard", "/m/leads", "/m/listings", "/m/deals", "/m/commissions", "/m/notifications", "/m/offline"]) expect(policy.SHELL).toContain(p);
  });
  it("routes requests to the right strategy", () => {
    const u = (p: string) => `https://app.nakhla.ai${p}`;
    expect(policy.classify("GET", u("/m/leads"))).toBe("network-first-page");
    expect(policy.classify("GET", u("/api/m/snapshot"))).toBe("network-first-data");
    expect(policy.classify("GET", u("/_next/static/chunks/a.js"))).toBe("cache-first");
    expect(policy.classify("POST", u("/api/m/actions"))).toBe("outbox");
    expect(policy.classify("POST", u("/api/leads"))).toBe("network");
    expect(policy.classify("GET", u("/admin/website"))).toBe("network");
  });
  it("trims caches oldest first and builds notifications from push payloads", () => {
    expect(policy.overflow([1, 2, 3, 4, 5], 3)).toEqual([1, 2]);
    expect(policy.overflow([1, 2], 3)).toEqual([]);
    const n = policy.notification({ title: "New lead: Sarah Whitfield", body: "Bayut enquiry", href: "/analyst/leads/1", category: "leads" });
    expect(n).toMatchObject({ title: "New lead: Sarah Whitfield", options: { body: "Bayut enquiry", tag: "leads", data: { href: "/analyst/leads/1" } } });
    expect(policy.notification(undefined).options.data.href).toBe("/m/notifications");
  });
});

describe("push delivery and offline data", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => {
    env = await testDb();
  }, 120_000);

  it("delivers to every subscription of the recipients, removes expired ones and counts failures", async () => {
    const { savePushSubscription, sendPush } = await import("@/lib/pwa/push");
    const user = { id: env.ua.id, tenantId: env.a.id };
    await savePushSubscription(env.db, user, { endpoint: "https://push.example.com/ok", keys: { p256dh: "p", auth: "a" } });
    await savePushSubscription(env.db, user, { endpoint: "https://push.example.com/gone", keys: { p256dh: "p", auth: "a" } });
    await savePushSubscription(env.db, user, { endpoint: "https://push.example.com/flaky", keys: { p256dh: "p", auth: "a" } });
    const sent: { endpoint: string; body: unknown }[] = [];
    const r = await sendPush(env.db, [env.ua.id, env.ub.id], { title: "Offer received", body: "AED 2.31M on Marina Gate 2", href: "/analyst/deals/1", category: "deals" }, async (sub, payload) => {
      if (sub.endpoint.endsWith("/gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      if (sub.endpoint.endsWith("/flaky")) throw Object.assign(new Error("Server"), { statusCode: 500 });
      sent.push({ endpoint: sub.endpoint, body: JSON.parse(payload) });
      return { statusCode: 201 };
    });
    expect(r).toMatchObject({ sent: 1, removed: 1 });
    expect(sent[0]!.body).toMatchObject({ title: "Offer received", href: "/analyst/deals/1" });
    const left = await env.db.select().from(s.pushTokens).where(eq(s.pushTokens.userId, env.ua.id));
    expect(left.map((x) => x.token).sort()).toEqual(["https://push.example.com/flaky", "https://push.example.com/ok"]);
    expect(left.find((x) => x.token.endsWith("flaky"))!.failures).toBe(1);
    expect((await sendPush(env.db, [env.ua.id], { title: "x", body: "y" }, null)).skipped).toMatch(/VAPID/);
  });

  it("notifies phones for lead, message, offer and commission notifications", async () => {
    const { PUSH_CATEGORIES } = await import("@/lib/pwa/push");
    for (const c of ["leads", "messages", "deals", "commissions"]) expect(PUSH_CATEGORIES.has(c)).toBe(true);
    expect(PUSH_CATEGORIES.has("reports")).toBe(false);
  });

  it("keeps the last 100 of each entity for offline use, scoped to the agent", async () => {
    const { agentSnapshot, SNAPSHOT_LIMIT, touchSession } = await import("@/lib/pwa/snapshot");
    const [agent] = await env.db.insert(s.users).values({ tenantId: env.a.id, name: "Agent A", email: "agent@a.example.com", role: "analyst" }).returning();
    await env.db.insert(s.leads).values(Array.from({ length: 120 }, (_, i) => ({ tenantId: env.a.id, reference: `LD-${1000 + i}`, name: `Lead ${i}`, email: `l${i}@example.com`, source: "website", market: "AE", intent: "buy" as const, currency: "AED", ownerUserId: i % 2 ? agent!.id : env.ua.id })));
    const mine = await agentSnapshot(env.db, { id: agent!.id, tenantId: env.a.id, role: "analyst" });
    expect(mine.leads).toHaveLength(60);
    const all = await agentSnapshot(env.db, { id: env.ua.id, tenantId: env.a.id, role: "tenant_admin" });
    expect(all.leads).toHaveLength(SNAPSHOT_LIMIT);
    const other = await agentSnapshot(env.db, { id: env.ub.id, tenantId: env.b.id, role: "tenant_admin" });
    expect(other.leads).toHaveLength(0);
    await touchSession(env.db, { id: agent!.id, tenantId: env.a.id }, "iPhone Safari", mine.version);
    await touchSession(env.db, { id: agent!.id, tenantId: env.a.id }, "iPhone Safari", "v2");
    const sessions = await env.db.select().from(s.mobileSessions).where(eq(s.mobileSessions.userId, agent!.id));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.cacheVersion).toBe("v2");
  });
});
