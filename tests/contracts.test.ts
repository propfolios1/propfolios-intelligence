import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { FILTERS, parse, render, TemplateError, variablesOf } from "@/lib/contracts/engine";
import { BUILT_INS } from "@/lib/contracts/templates";
import { blocks } from "@/lib/contracts/html-blocks";
import { testDb } from "./helpers/pglite";

describe("template engine", () => {
  it("renders variables, escapes HTML and reports what is missing", () => {
    const r = render("<p>{{buyer.name}} buys {{property.name}} for {{price | money}}.</p>", { buyer: { name: "Ahmed <Al> Mansoori & Co" }, price: 2450000.5, currency: "AED" });
    expect(r.html).toBe('<p>Ahmed &lt;Al&gt; Mansoori &amp; Co buys <mark class="missing">[property.name]</mark> for AED 2,450,000.50.</p>');
    expect(r.missing).toEqual(["property.name"]);
  });
  it("evaluates conditions safely: comparisons, and, or, not, unless and else", () => {
    const t = "{{#if buyer.isNri && price >= 5000000}}A{{else}}B{{/if}}{{#unless seller.isCompany}}C{{/unless}}{{#if !(tenure == 'leasehold') || x}}D{{/if}}";
    expect(render(t, { buyer: { isNri: true }, price: 6000000, seller: { isCompany: false }, tenure: "freehold" }).html).toBe("ACD");
    expect(render(t, { buyer: { isNri: true }, price: 100, seller: { isCompany: true }, tenure: "leasehold" }).html).toBe("B");
    // Nothing is executed: an injection attempt is a parse error, not code.
    expect(() => parse("{{#if constructor.constructor('return 1')()}}x{{/if}}")).toThrow(TemplateError);
  });
  it("loops with 1-based index and item fields", () => {
    expect(render("<ol>{{#each conditions}}<li>{{@index}}. {{this}}</li>{{/each}}</ol>", { conditions: ["Mortgage approval", "Snagging"] }).html).toBe("<ol><li>1. Mortgage approval</li><li>2. Snagging</li></ol>");
    expect(render("{{#each owners}}{{name}} {{pct | pct}}; {{/each}}", { owners: [{ name: "A", pct: 60 }, { name: "B", pct: 40 }] }).html).toBe("A 60%; B 40%; ");
  });
  it("formats money per currency, dates and amounts in words", () => {
    expect(FILTERS.money!(12345678.9, { currency: "INR" })).toBe("₹1,23,45,678.90");
    expect(FILTERS.long!("2026-10-04", {})).toBe("4 October 2026");
    expect(FILTERS.words!(2450000, {})).toBe("Two million four hundred and fifty thousand");
    expect(FILTERS.words!(1001, {})).toBe("One thousand and one");
  });
  it("rejects malformed templates with a position", () => {
    expect(() => parse("{{#if x}}open")).toThrow(/not closed/);
    expect(() => parse("{{/if}}")).toThrow(/does not close/);
    expect(() => parse("{{price | shout}}")).toThrow(/Unknown filter/);
    expect(() => parse("{{else}}")).toThrow(/without an open/);
  });
  it("lists the variables a template uses, including those in conditions", () => {
    expect(variablesOf("{{a.b}} {{#if c > 1 && !d}}{{e | money}}{{/if}}{{#each f}}{{this}}{{/each}}")).toEqual(["a.b", "c", "d", "e", "f"]);
  });
});

describe("built-in templates", () => {
  it("every built-in parses, and its declared inputs are used in the body", () => {
    for (const b of BUILT_INS) {
      expect(() => parse(b.body), b.key).not.toThrow();
      const vars = variablesOf(b.body);
      for (const i of b.inputs) expect(vars, `${b.key} declares ${i.path}`).toContain(i.path);
    }
    expect(BUILT_INS.map((b) => b.key)).toEqual(["ae_form_a", "ae_form_b", "ae_form_f", "in_maharera_afs", "gb_sale_contract", "sg_cea_sale", "custom"]);
  });
  it("adds the FEMA clause only for a non-resident purchaser, and the right TDS section", () => {
    const afs = BUILT_INS.find((b) => b.key === "in_maharera_afs")!.body;
    const base = { reference: "DL-1", date: "2026-10-04", currency: "INR", price: 45000000, seller: { name: "Lodha Developers", isNri: false }, property: { unit: "1802", name: "Lodha Park", community: "Worli", city: "Mumbai", carpetAreaSqm: 112 }, reraNumber: "P51900000001", possessionDate: "2028-12-31" };
    const nri = render(afs, { ...base, buyer: { name: "Rahul Khanna", isNri: true } }).html;
    const resident = render(afs, { ...base, buyer: { name: "Rahul Khanna", isNri: false } }).html;
    expect(nri).toContain("Foreign Exchange Management (Non-debt Instruments) Rules 2019");
    expect(nri).toContain("a person resident outside India");
    expect(resident).not.toContain("Foreign Exchange Management");
    expect(resident).toContain("section 194-IA");
    expect(render(afs, { ...base, seller: { name: "X", isNri: true }, buyer: { name: "Y" } }).html).toContain("section 195");
  });
  it("Form F adds mortgage clauses on the inputs", () => {
    const f = BUILT_INS.find((b) => b.key === "ae_form_f")!.body;
    const html = render(f, { mortgage: { buyer: true, seller: false }, price: 2400000, currency: "AED" }).html;
    expect(html).toContain("purchasing with mortgage finance");
    expect(html).not.toContain("liability letter");
    expect(html).toContain("Two million four hundred thousand AED");
  });
  it("splits rendered HTML into PDF blocks", () => {
    const b = blocks("<h2>Title</h2><p>One <strong>bold</strong></p><ol><li>A</li><li>B</li></ol>");
    expect(b).toEqual([{ tag: "h2", html: "Title" }, { tag: "p", html: "One <strong>bold</strong>" }, { tag: "ol", items: ["A", "B"] }]);
  });
});

describe("templates and deals", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let c: typeof import("@/lib/contracts/service");
  let dealId: string;
  beforeAll(async () => {
    env = await testDb();
    c = await import("@/lib/contracts/service");
    const db = env.db;
    const [dev] = await db.insert(s.developers).values({ tenantId: env.a.id, name: "Test Developer", market: "India", hq: "Mumbai", deliveryPct: 90, financialHealth: 80, litigationCount: 0, sentimentScore: 70, riskScore: 20, riskBreakdown: {}, projectsDelivered: 10, unitsDelivered: 1000, summary: "Test", lastScoredAt: new Date() } as never).returning();
    const [prop] = await db.insert(s.properties).values({ tenantId: env.a.id, slug: "worli-one", name: "Worli One", developerId: dev!.id, market: "India", city: "Mumbai", region: "Maharashtra", community: "Worli", assetClass: "Apartment", status: "ready", handover: "Ready", currency: "INR", priceMin: 40_000_000, priceMax: 60_000_000, pricePerSqft: 60_000, units: 100, grossYield: 3, reraNumber: "P51900000001", lat: 19.0, lng: 72.8, description: "Test" } as never).returning();
    const [client] = await db.insert(s.clients).values({ tenantId: env.a.id, name: "Rahul Khanna", type: "HNWI", nationality: "Indian", residency: "NRI (UAE)", domicile: "UAE", aumAed: 10_000_000, riskProfile: "Balanced", policy: {} as never }).returning();
    const [deal] = await db.insert(s.deals).values({ tenantId: env.a.id, reference: "DL-0001", title: "Worli One 3BR", clientId: client!.id, propertyId: prop!.id, jurisdiction: "mumbai", dealType: "residential_resale", side: "buy", currency: "INR", value: 45_000_000, ownerUserId: env.ua.id, counterparty: "Worli One Developers Pvt Ltd" }).returning();
    dealId = deal!.id;
  });

  it("installs the library once per workspace, published", async () => {
    expect(await c.ensureTemplates(env.db, env.a.id)).toBe(true);
    expect(await c.ensureTemplates(env.db, env.a.id)).toBe(false);
    const list = await c.listTemplates(env.db, env.a.id);
    expect(list).toHaveLength(BUILT_INS.length);
    expect(list.every((t) => t.current.status === "published" && t.current.version === 1)).toBe(true);
  });

  it("versions edits: editing a published template opens a draft; publishing archives the old version", async () => {
    const list = await c.listTemplates(env.db, env.a.id);
    const afs = list.find((t) => t.family === "in_maharera_afs")!.current;
    await expect(c.editTemplate(env.db, env.a.id, afs.id, { body: "{{#if x}}broken" })).rejects.toThrow(/not closed/);
    const draft = await c.editTemplate(env.db, env.a.id, afs.id, { body: `${afs.body}\n<p>Firm clause: {{firm.registeredOffice}}.</p>` });
    expect(draft).toMatchObject({ version: 2, status: "draft" });
    const again = await c.editTemplate(env.db, env.a.id, afs.id, { name: "Agreement for Sale (Maharashtra)" });
    expect(again.id).toBe(draft.id);
    const pub = await c.publishTemplate(env.db, env.a.id, draft.id, { note: "Added the registered office line.", userId: env.ua.id });
    expect(pub.status).toBe("published");
    const { versions } = await c.getTemplate(env.db, env.a.id, pub.id);
    expect(versions.map((v) => [v.version, v.status])).toEqual([
      [2, "published"],
      [1, "archived"],
    ]);
  });

  it("drafts a deal contract with deal, firm and entered values; blocks signature while anything is missing", async () => {
    await c.setFirmVariable(env.db, env.a.id, { path: "firm.registeredOffice", label: "Registered office", value: "Level 12, One BKC, Mumbai" });
    const afs = (await c.listTemplates(env.db, env.a.id)).find((t) => t.family === "in_maharera_afs")!.published!;
    const first = await c.draftFromTemplate(env.db, env.a.id, env.ua, { dealId, templateId: afs.id, values: {} });
    expect(first.missing).toEqual(expect.arrayContaining(["property.unit", "property.carpetAreaSqm", "possessionDate"]));
    expect(first.contract.contentHtml).toContain("Foreign Exchange Management");
    expect(first.contract.contentHtml).toContain("Level 12, One BKC, Mumbai");
    expect(first.contract.contentHtml).toContain("template version 2");
    const { sendForSignature } = await import("@/lib/deals/service");
    await expect(sendForSignature(env.db, { tenantId: env.a.id, name: "Admin A" }, first.contract.id, [{ party: "buyer", name: "Rahul Khanna", email: "rahul@example.com" }], { skipEmail: true })).rejects.toThrow(/Complete property.unit/);
    const second = await c.draftFromTemplate(env.db, env.a.id, env.ua, { dealId, templateId: afs.id, values: { "property.unit": "1802", "property.carpetAreaSqm": 112, possessionDate: "2028-12-31" } });
    expect(second.missing).toEqual([]);
    expect(second.contract.version).toBe(2);
    expect(second.contract.contentHtml).toContain("31 December 2028");
    const [inst] = await env.db.select().from(s.contractInstances).where(eq(s.contractInstances.contractId, second.contract.id));
    expect(inst).toMatchObject({ templateVersion: 2, contentHash: second.contract.contentHash });
  });

  it("keeps templates and variables per firm", async () => {
    const afs = (await c.listTemplates(env.db, env.a.id)).find((t) => t.family === "in_maharera_afs")!.current;
    await expect(c.getTemplate(env.db, env.b.id, afs.id)).rejects.toThrow(/not found/i);
    await expect(c.draftFromTemplate(env.db, env.b.id, env.ub, { dealId, templateId: afs.id, values: {} })).rejects.toThrow(/not found/i);
    expect(await c.firmVariables(env.db, env.b.id)).toEqual([]);
  });
});
