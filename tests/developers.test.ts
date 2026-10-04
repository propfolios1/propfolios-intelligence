import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@/db/schema";
import { autoMap, normaliseStatus, recordsFrom, sandboxFeed, toUnits } from "@/lib/developers/adapters";
import { DEVELOPERS } from "@/lib/developers/catalogue";
import { testDb } from "./helpers/pglite";

afterEach(() => vi.unstubAllGlobals());

describe("feed adapters", () => {
  it("maps developer headers to canonical fields, with overrides", () => {
    const m = autoMap(["Unit No", "Project Name", "Tower", "BHK", "Saleable Area", "Agreement Value", "Inventory Status", "Possession Date"]);
    expect(m).toMatchObject({ unitRef: "Unit No", project: "Project Name", building: "Tower", bedrooms: "BHK", areaSqft: "Saleable Area", price: "Agreement Value", status: "Inventory Status", handover: "Possession Date" });
    expect(autoMap(["Ref", "Cost"], { unitRef: "Ref", price: "Cost" })).toMatchObject({ unitRef: "Ref", price: "Cost" });
  });
  it("reads CSV, JSON and XML feeds", () => {
    expect(recordsFrom("Unit,Price\nA-101,\"1,200,000\"\nA-102,1300000\n", "csv")).toEqual([
      { Unit: "A-101", Price: "1,200,000" },
      { Unit: "A-102", Price: "1300000" },
    ]);
    expect(recordsFrom(JSON.stringify({ inventory: [{ unit: "B-1" }] }), "json")).toEqual([{ unit: "B-1" }]);
    expect(recordsFrom('<feed><unit id="C-1"><price>900000</price><status><![CDATA[On Hold]]></status></unit></feed>', "xml")).toEqual([{ id: "C-1", price: "900000", status: "On Hold" }]);
    expect(() => recordsFrom("{}", "json")).toThrow(/no list of units/);
  });
  it("normalises statuses, studios, prices and duplicate rows", () => {
    expect(["Available", "On hold", "Booked", "SPA signed", "Sold", "Not for sale"].map(normaliseStatus)).toEqual(["available", "reserved", "reserved", "sold", "sold", "withdrawn"]);
    const { units, rejected } = toUnits(
      [
        { Unit: "A-1", Type: "Studio", Price: "AED 850,000", Status: "Available" },
        { Unit: "A-1", Type: "1 Bedroom", Price: "1", Status: "Available" },
        { Unit: "", Price: "1" },
      ],
      { unitRef: "Unit", unitType: "Type", price: "Price", status: "Status" },
      { currency: "AED", project: "Test" },
    );
    expect(rejected).toBe(2);
    expect(units[0]).toMatchObject({ unitRef: "A-1", bedrooms: 0, price: 850000, status: "available", project: "Test" });
  });
  it("produces a deterministic sandbox feed that changes over time", () => {
    const d1 = new Date("2026-10-01T00:00:00Z");
    const a = sandboxFeed("emaar", "Emaar Properties", "AE", d1);
    expect(a).toEqual(sandboxFeed("emaar", "Emaar Properties", "AE", d1));
    expect(a.length).toBeGreaterThanOrEqual(12);
    const later = sandboxFeed("emaar", "Emaar Properties", "AE", new Date("2027-01-15T00:00:00Z"));
    expect(later.filter((u) => u.Status === "Sold").length).toBeGreaterThan(a.filter((u) => u.Status === "Sold").length);
    expect(DEVELOPERS.map((d) => d.key)).toHaveLength(14);
  });
});

describe("inventory sync", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let d: typeof import("@/lib/developers/sync");
  const feed = (rows: string[]) => `Unit No,Project,Bedrooms,Area,Price,Status\n${rows.join("\n")}\n`;
  beforeAll(async () => {
    env = await testDb();
    d = await import("@/lib/developers/sync");
  });

  it("adds units, records price and status changes, withdraws missing units and keeps inventory when a feed fails", async () => {
    const c = await d.connectDeveloper(env.db, env.a.id, { developerKey: "lodha", mode: "feed_url", url: "https://feeds.example.com/lodha.csv", format: "csv", authHeader: "Bearer secret" });
    let body = feed(["W-1801,Lodha World One,3,1650,52000000,Available", "W-1802,Lodha World One,2,1100,36000000,Available", "W-2201,Lodha World One,4,2400,78000000,Booked"]);
    let status = 200;
    let auth: string | null = null;
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      auth = new Headers(init.headers).get("authorization");
      return new Response(body, { status, headers: { "content-type": "text/csv" } });
    });
    const r1 = await d.syncConnection(env.db, env.a.id, c.id, { now: new Date("2026-10-01T06:00:00Z") });
    expect(r1).toMatchObject({ ok: true, units: 3, added: 0, priceChanges: 0, removed: 0 });
    expect(auth).toBe("Bearer secret");
    body = feed(["W-1801,Lodha World One,3,1650,50500000,Available", "W-1802,Lodha World One,2,1100,36000000,Sold", "W-2502,Lodha World One,3,1700,54000000,Available"]);
    const r2 = await d.syncConnection(env.db, env.a.id, c.id, { now: new Date("2026-10-02T06:00:00Z") });
    expect(r2).toMatchObject({ ok: true, units: 3, added: 1, priceChanges: 1, statusChanges: 1, removed: 1 });
    const units = await env.db.select().from(s.developerInventory).where(eq(s.developerInventory.connectionId, c.id));
    const u = (ref: string) => units.find((x) => x.unitRef === ref)!;
    expect(u("W-1801")).toMatchObject({ price: 50_500_000, previousPrice: 52_000_000, currency: "INR" });
    expect(u("W-1802").status).toBe("sold");
    expect(u("W-2201")).toMatchObject({ status: "withdrawn" });
    expect(u("W-2201").removedAt).not.toBeNull();
    const notes = await env.db.select().from(s.notifications).where(eq(s.notifications.tenantId, env.a.id));
    expect(notes.some((n) => n.title.includes("1 unit newly available"))).toBe(true);
    status = 503;
    const r3 = await d.syncConnection(env.db, env.a.id, c.id, { now: new Date("2026-10-03T06:00:00Z") });
    expect(r3.ok).toBe(false);
    expect((await env.db.select().from(s.developerInventory).where(eq(s.developerInventory.connectionId, c.id))).filter((x) => x.status !== "withdrawn")).toHaveLength(3);
    const [conn] = await env.db.select().from(s.developerConnections).where(eq(s.developerConnections.id, c.id));
    expect(conn).toMatchObject({ status: "error", units: 3 });
    expect(conn!.history.map((h) => h.ok)).toEqual([false, true, true]);
  });

  it("syncs uploads and the sandbox, and rejects a feed without unit numbers", async () => {
    const up = await d.connectDeveloper(env.db, env.a.id, { developerKey: "acron", mode: "upload" });
    expect((await d.syncConnection(env.db, env.a.id, up.id)).error).toMatch(/Upload/);
    const r = await d.syncConnection(env.db, env.a.id, up.id, { upload: { body: JSON.stringify([{ unit_no: "V-7", price: 120000000, status: "Available", bedrooms: 5 }]), format: "json" } });
    expect(r).toMatchObject({ ok: true, units: 1 });
    expect((await d.syncConnection(env.db, env.a.id, up.id, { upload: { body: "Price\n100\n", format: "csv" } })).error).toMatch(/No unit number column/);
    const sb = await d.connectDeveloper(env.db, env.a.id, { developerKey: "emaar", mode: "sandbox" });
    expect((await d.syncConnection(env.db, env.a.id, sb.id, { now: new Date("2026-10-01T00:00:00Z") })).units).toBeGreaterThanOrEqual(12);
    await expect(d.connectDeveloper(env.db, env.a.id, { developerKey: "emaar", mode: "feed_url", url: "http://insecure.example.com" })).rejects.toThrow(/HTTPS/);
  });

  it("matches units to buyers by budget and market, and keeps each firm's inventory separate", async () => {
    await env.db.insert(s.leads).values([
      { tenantId: env.a.id, reference: "LD-1", name: "Anil Mehta", email: "a@example.com", source: "website", market: "IN", intent: "buy", currency: "INR", budgetMax: 55_000_000, score: 80 },
      { tenantId: env.a.id, reference: "LD-2", name: "Small Budget", email: "b@example.com", source: "website", market: "IN", intent: "buy", currency: "INR", budgetMax: 20_000_000, score: 90 },
    ]);
    expect((await d.matchingLeads(env.db, env.a.id, { price: 50_500_000, currency: "INR" }, "IN")).map((x) => x.name)).toEqual(["Anil Mehta"]);
    expect((await d.inventoryView(env.db, env.b.id, "lodha")).connection).toBeNull();
    const v = await d.inventoryView(env.db, env.a.id, "lodha", { status: "available" });
    expect(v.units.map((x) => x.unitRef).sort()).toEqual(["W-1801", "W-2502"]);
    expect(v.changes.length).toBeGreaterThan(0);
  });
});
