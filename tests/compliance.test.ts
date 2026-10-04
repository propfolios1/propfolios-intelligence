import { eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@/db/schema";
import { JURISDICTIONS } from "@/lib/compliance/jurisdictions";
import { buildReport, goAmlXml, narrative, toCsv } from "@/lib/compliance/reports";
import { testDb } from "./helpers/pglite";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.OPENSANCTIONS_API_KEY;
});

const firm = { name: "Test Brokerage A", entityId: "12345", mlroName: "Layla Haddad", mlroEmail: "mlro@a.example.com" };
const tx = { reference: "DL-0001", date: "2026-09-30", amount: 2_400_000, currency: "AED", mode: "cash" as const, cashAmount: 60_000, property: "Marina Gate <Tower 2> & Podium", parties: [{ name: "Omar Saleh", entityType: "person" as const, nationality: "AE", role: "buyer" as const }, { name: "Harbour Holdings Ltd", entityType: "company" as const, role: "seller" as const }] };

describe("jurisdictions", () => {
  it("names the supervisor and the receiving FIU separately, and never claims less than five years' retention", () => {
    expect(JURISDICTIONS.IN.fiu).toContain("FIU-IND");
    expect(JURISDICTIONS.IN.fiu).not.toMatch(/RBI|Reserve Bank/);
    expect(JURISDICTIONS.GB.supervisor).toContain("HM Revenue and Customs");
    expect(JURISDICTIONS.GB.fiu).toContain("National Crime Agency");
    expect(JURISDICTIONS.SG.supervisor).toContain("Council for Estate Agencies");
    expect(JURISDICTIONS.SG.fiu).toContain("STRO");
    for (const j of Object.values(JURISDICTIONS)) expect(j.statutoryRetentionYears).toBeGreaterThanOrEqual(5);
  });
});

describe("reports", () => {
  it("builds a goAML REAR with escaped values, transmode and both parties", () => {
    const x = goAmlXml({ jurisdiction: "AE", type: "rear", firm, submittedAt: new Date("2026-10-04T08:00:00Z"), reference: "REAR-1", transactions: [tx] });
    expect(x).toContain("<report_code>REAR</report_code>");
    expect(x).toContain("<rentity_id>12345</rentity_id>");
    expect(x).toContain("<transmode_code>C</transmode_code>");
    expect(x).toContain("<amount_local>2400000.00</amount_local>");
    expect(x).toContain("Marina Gate &lt;Tower 2&gt; &amp; Podium");
    expect(x).toContain("<t_from><to_person><first_name>Omar</first_name><last_name>Saleh</last_name>");
    expect(x).toContain("<t_to><to_entity><name>Harbour Holdings Ltd</name>");
  });
  it("produces FIU-IND CSV, a UK SAR narrative with the DAML reminder, and guards CSV formulas", () => {
    const ctr = buildReport({ jurisdiction: "IN", type: "ctr", firm, submittedAt: new Date(), reference: "CTR-1", period: "2026-09", transactions: [{ ...tx, currency: "INR", amount: 12_500_000, cashAmount: 1_200_000 }] });
    expect(ctr.format).toBe("csv");
    expect(ctr.content.split("\r\n")[0]).toContain("Cash (INR)");
    expect(ctr.content).toContain("1200000.00");
    const sar = narrative({ jurisdiction: "GB", type: "sar", firm, submittedAt: new Date(), reference: "SAR-1", reason: "Buyer insisted on paying the deposit in cash from an unexplained source.", transactions: [{ ...tx, currency: "GBP" }] });
    expect(sar).toContain("Suspicious Activity Report (SAR) for UKFIU, National Crime Agency");
    expect(sar).toContain("Defence Against Money Laundering");
    expect(sar).toContain("tipping off");
    expect(toCsv(["a"], [["=HYPERLINK(1)"]])).toBe("a\r\n'=HYPERLINK(1)\r\n");
  });
});

describe("compliance service", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let c: typeof import("@/lib/compliance/service");
  let clientId: string;
  let dealId: string;
  beforeAll(async () => {
    env = await testDb();
    c = await import("@/lib/compliance/service");
    const db = env.db;
    const [dev] = await db.insert(s.developers).values({ tenantId: env.a.id, name: "Test Developer", market: "UAE", hq: "Dubai", deliveryPct: 90, financialHealth: 80, litigationCount: 0, sentimentScore: 70, riskScore: 20, riskBreakdown: {}, projectsDelivered: 10, unitsDelivered: 1000, summary: "Test", lastScoredAt: new Date() } as never).returning();
    const [prop] = await db.insert(s.properties).values({ tenantId: env.a.id, slug: "marina-gate", name: "Marina Gate", developerId: dev!.id, market: "UAE", city: "Dubai", region: "Dubai", community: "Dubai Marina", assetClass: "Apartment", status: "ready", handover: "Ready", currency: "AED", priceMin: 2_000_000, priceMax: 3_000_000, pricePerSqft: 2_000, units: 100, grossYield: 6, reraNumber: "R-1", lat: 25.08, lng: 55.14, description: "Test" } as never).returning();
    const [client] = await db.insert(s.clients).values({ tenantId: env.a.id, name: "Omar Saleh", type: "HNWI", nationality: "Emirati", residency: "UAE resident", domicile: "UAE", aumAed: 10_000_000, riskProfile: "Balanced", policy: {} as never }).returning();
    clientId = client!.id;
    const [deal] = await db.insert(s.deals).values({ tenantId: env.a.id, reference: "DL-0001", title: "Marina Gate 2BR", clientId, propertyId: prop!.id, jurisdiction: "dubai", dealType: "residential_resale", side: "buy", currency: "AED", value: 2_400_000, ownerUserId: env.ua.id, counterparty: "Harbour Holdings Ltd" }).returning();
    dealId = deal!.id;
  });

  it("screens against the sample list without a provider key, flags matches and schedules re-screening", async () => {
    const hit = await c.screen(env.db, env.a.id, { subjectType: "lead", name: "Viktor Sokolov", jurisdiction: "AE" });
    expect(hit.status).toBe("potential_match");
    expect(hit.provider).toContain("demonstration only");
    expect(hit.nextReviewAt!.getTime() - hit.createdAt.getTime()).toBeLessThan(91 * 86_400_000);
    const clear = await c.screen(env.db, env.a.id, { subjectType: "client", subjectId: clientId, name: "Omar Saleh", jurisdiction: "AE" });
    expect(clear.status).toBe("clear");
    expect(clear.retainUntil.getUTCFullYear()).toBe(clear.createdAt.getUTCFullYear() + 7);
    const notes = await env.db.select().from(s.notifications).where(eq(s.notifications.tenantId, env.a.id));
    expect(notes.some((n) => n.title.includes("Viktor Sokolov"))).toBe(true);
  });

  it("uses OpenSanctions when configured, maps topics to risk, and never reports a failed screen as clear", async () => {
    process.env.OPENSANCTIONS_API_KEY = "test-key";
    let auth: string | null = null;
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      auth = new Headers(init.headers).get("authorization");
      const body = JSON.parse(String(init.body));
      expect(body.queries.q.schema).toBe("Person");
      return new Response(JSON.stringify({ responses: { q: { results: [{ id: "Q123", caption: "Jane Example", score: 0.91, match: true, datasets: ["gb_hmt_sanctions"], properties: { topics: ["sanction"], position: [] } }] } } }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const r = await c.screen(env.db, env.a.id, { subjectType: "lead", name: "Jane Example", jurisdiction: "GB" });
    expect(auth).toBe("ApiKey test-key");
    expect(r).toMatchObject({ provider: "OpenSanctions", status: "potential_match", riskScore: 91 });
    expect(r.hits[0]!.url).toBe("https://www.opensanctions.org/entities/Q123/");
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    const e = await c.screen(env.db, env.a.id, { subjectType: "lead", name: "Someone Else", jurisdiction: "GB" });
    expect(e.status).toBe("error");
  });

  it("rates risk from PEP status, high-risk countries, screening and cash", () => {
    expect(c.rateRisk({ pepDeclared: false, entityType: "person", beneficialOwners: [], sourceOfFunds: "Salary and bonus" }, { status: "clear", hits: [] }, [], false)).toMatchObject({ rating: "low", level: "standard" });
    const r = c.rateRisk({ pepDeclared: true, nationality: "Iran", entityType: "person", beneficialOwners: [], sourceOfFunds: "Sale of a business" }, null, ["Iran"], true);
    expect(r.rating).toBe("high");
    expect(r.factors).toEqual(["Politically exposed person", "Connection with a high-risk jurisdiction", "Cash or virtual-asset payment"]);
  });

  it("runs KYC from draft to approval only when documents, screening and source of funds are complete", async () => {
    const k = await c.startKyc(env.db, env.a.id, { subjectType: "client", clientId, name: "Omar Saleh", jurisdiction: "AE" });
    expect(k.documents.map((d) => d.label)).toEqual(JURISDICTIONS.AE.cdd.person);
    await expect(c.submitKyc(env.db, env.a.id, k.id, { clientId })).rejects.toThrow(/Upload/);
    // The client can attach documents to their own record, but cannot mark them verified.
    await c.updateKyc(env.db, env.a.id, k.id, { documents: k.documents.map((d) => ({ type: d.type, documentId: crypto.randomUUID(), status: "verified" })), sourceOfFunds: "Proceeds of the sale of a villa in Arabian Ranches" }, { clientId });
    const submitted = await c.submitKyc(env.db, env.a.id, k.id, { clientId });
    expect(submitted.status).toBe("submitted");
    expect(submitted.documents.every((d) => d.status === "uploaded")).toBe(true);
    await expect(c.updateKyc(env.db, env.a.id, k.id, { sourceOfFunds: "Changed" }, { clientId })).rejects.toThrow(/submitted/);
    await expect(c.decideKyc(env.db, env.a.id, k.id, { decision: "approved", note: "", userId: env.ua.id })).rejects.toThrow(/Verify/);
    await c.updateKyc(env.db, env.a.id, k.id, { documents: k.documents.map((d) => ({ type: d.type, status: "verified" as const })) }, {});
    const ok = await c.decideKyc(env.db, env.a.id, k.id, { decision: "approved", note: "Documents certified.", userId: env.ua.id });
    expect(ok).toMatchObject({ status: "approved", riskRating: "low" });
    expect(ok.expiresAt!.getTime() - ok.decidedAt!.getTime()).toBeGreaterThan(3 * 364 * 86_400_000);
    const [cl] = await env.db.select().from(s.clients).where(eq(s.clients.id, clientId));
    expect(cl!.kycStatus).toBe("verified");
    // Another firm's client user cannot reach it.
    await expect(c.updateKyc(env.db, env.b.id, k.id, { sourceOfFunds: "x" }, {})).rejects.toThrow(/not found/i);
  });

  it("evaluates a deal: cash over AED 55,000 requires a REAR, which passes once filed", async () => {
    const [p] = await env.db.insert(s.paymentsSchedule).values({ tenantId: env.a.id, dealId, milestone: "Deposit", amount: 240_000, currency: "AED", dueDate: "2026-09-20", status: "paid" }).returning();
    await c.recordPaymentMethod(env.db, env.a.id, p!.id, { method: "mixed", cashAmount: 60_000 });
    const r1 = await c.evaluateDeal(env.db, env.a.id, dealId);
    const by = (rule: string) => r1.checks.find((x) => x.rule === rule)!;
    expect(by("cdd_client").status).toBe("pass");
    expect(by("screen_client").status).toBe("pass");
    expect(by("screen_counterparty").status).toBe("pass");
    expect(by("cash")).toMatchObject({ status: "action_required", basis: "statutory" });
    expect(by("cash").detail).toContain("Real Estate Activity Report");
    expect(by("edd").status).toBe("action_required");
    const rep = await c.prepareReport(env.db, env.a.id, env.ua, { jurisdiction: "AE", type: "rear", dealId });
    expect(rep).toMatchObject({ format: "goaml_xml", status: "draft" });
    expect(rep.content).toContain("<report_code>REAR</report_code>");
    expect(rep.content).toContain("<comments>Cash component AED 60000.00</comments>");
    expect((await c.evaluateDeal(env.db, env.a.id, dealId)).checks.find((x) => x.rule === "open_reports")!.status).toBe("action_required");
    await expect(c.setReportStatus(env.db, env.a.id, rep.id, { status: "filed", userId: env.ua.id })).rejects.toThrow(/filing reference/);
    await c.setReportStatus(env.db, env.a.id, rep.id, { status: "filed", reference: "GOAML-2026-778812", userId: env.ua.id });
    const r2 = await c.evaluateDeal(env.db, env.a.id, dealId);
    expect(r2.checks.find((x) => x.rule === "cash")!.status).toBe("pass");
    expect(r2.checks.find((x) => x.rule === "open_reports")!.status).toBe("pass");
    await expect(c.setReportStatus(env.db, env.a.id, rep.id, { status: "withdrawn", userId: env.ua.id })).rejects.toThrow(/cannot be changed/);
  });

  it("requires grounds for an STR and keeps the CDD register current", async () => {
    await expect(c.prepareReport(env.db, env.a.id, env.ua, { jurisdiction: "AE", type: "str", dealId })).rejects.toThrow(/grounds/);
    const reg = await c.prepareReport(env.db, env.a.id, env.ua, { jurisdiction: "AE", type: "kyc_register" });
    expect(reg.status).toBe("ready");
    expect(reg.content).toContain("Omar Saleh,person,standard,low,approved");
  });

  it("monitors daily: re-screens due subjects, expires lapsed KYC, purges past retention, and stays within a tenant", async () => {
    const future = new Date(Date.now() + 400 * 86_400_000);
    const r = await c.runMonitoring(env.db, { now: future, tenantIds: [env.a.id] });
    expect(r.rescreened).toBeGreaterThanOrEqual(2);
    const late = new Date(Date.now() + 8 * 365.25 * 86_400_000);
    const before = (await env.db.select().from(s.amlScreenings)).length;
    const purge = await c.runMonitoring(env.db, { now: late, tenantIds: [env.b.id] });
    expect(purge.purged.screenings).toBe(0);
    expect((await env.db.select().from(s.amlScreenings)).length).toBeGreaterThanOrEqual(before);
    const kept = await c.runMonitoring(env.db, { now: late, tenantIds: [env.a.id] });
    expect(kept.purged.screenings).toBeGreaterThan(0);
    expect(kept.purged.reports).toBeGreaterThanOrEqual(1);
  });
});
