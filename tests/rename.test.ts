import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { uid } from "@/db/seed";
import { renameDemoTenants } from "@/db/seed-tenants";
import { testDb } from "./helpers/pglite";

describe("one-time demonstration tenant rename", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => {
    env = await testDb();
    const cfg = (await env.db.select().from(s.tenants).where(eq(s.tenants.id, env.a.id)))[0]!.configJson;
    await env.db.insert(s.tenants).values([
      { id: uid("tenant"), name: "PropFolios", slug: "propfolios", plan: "professional", status: "active", configJson: { ...cfg, brand_name: "PropFolios Intelligence" } },
      { id: uid("tenant:gulfrealty"), name: "Gulf Realty Advisors", slug: "gulfrealty", plan: "professional", status: "active", configJson: cfg },
    ]);
    await env.db.insert(s.users).values([
      { tenantId: uid("tenant"), name: "Amol Bandekar", email: "amol@propfolios.ae", role: "tenant_admin" },
      { tenantId: uid("tenant:gulfrealty"), name: "Omar Haddad", email: "omar@gulfrealty.ae", role: "tenant_admin", clerkUserId: "user_real_signin" },
    ]);
    await env.db.insert(s.leads).values([
      { tenantId: uid("tenant"), reference: "LD-0001", name: "Lead", email: "x@example.com", source: "website", market: "AE", intent: "buy", currency: "AED", message: "Referred by PropFolios" },
      { tenantId: env.a.id, reference: "LD-0001", name: "Other", email: "y@example.com", source: "website", market: "AE", intent: "buy", currency: "AED", message: "Compared with PropFolios" },
    ]);
  }, 120_000);

  it("renames only seeded, never-signed-in demonstration tenants and only their rows", async () => {
    const out = await renameDemoTenants(env.db);
    expect(out.find((o) => o.tenantId === uid("tenant"))).toMatchObject({ renamed: true, to: "Nakhla Demo Brokerage" });
    expect(out.find((o) => o.tenantId === uid("tenant:gulfrealty"))).toMatchObject({ renamed: false });
    const [main] = await env.db.select().from(s.tenants).where(eq(s.tenants.id, uid("tenant")));
    expect(main).toMatchObject({ name: "Nakhla Demo Brokerage", slug: "nakhla-demo" });
    const [gulf] = await env.db.select().from(s.tenants).where(eq(s.tenants.id, uid("tenant:gulfrealty")));
    expect(gulf!.name).toBe("Gulf Realty Advisors");
    const leads = await env.db.select().from(s.leads);
    expect(leads.find((l) => l.tenantId === uid("tenant"))!.message).toBe("Referred by Nakhla Demo Brokerage");
    expect(leads.find((l) => l.tenantId === env.a.id)!.message).toBe("Compared with PropFolios");
    const [admin] = await env.db.select().from(s.users).where(eq(s.users.tenantId, uid("tenant")));
    expect(admin!.email).toBe("karim.nasser@demo.nakhla.ai");
  });

  it("is idempotent", async () => {
    const again = await renameDemoTenants(env.db);
    expect(again.every((o) => !o.renamed)).toBe(true);
  });
});
