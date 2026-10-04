import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@/db/schema";
import { csvRecords, detectDelimiter, parseCsv } from "@/lib/migration/csv";
import { autoMap, buildLead, buildListing, normalisePhone, parseAmount, parseDate } from "@/lib/migration/fields";
import { flatten, SOURCES } from "@/lib/migration/sources";
import { open, seal, signState, verifyState } from "@/lib/integrations/vault";
import { testDb } from "./helpers/pglite";

afterEach(() => vi.unstubAllGlobals());

describe("CSV parsing", () => {
  it("handles quotes, embedded delimiters, line breaks, CRLF and a byte-order mark", () => {
    const text = '﻿Name,Email,Notes\r\n"Doe, Jane",jane@example.com,"Said ""call me""\nafter 6pm"\r\nOmar,omar@example.com,\r\n\r\n';
    expect(parseCsv(text)).toEqual([
      ["Name", "Email", "Notes"],
      ["Doe, Jane", "jane@example.com", 'Said "call me"\nafter 6pm'],
      ["Omar", "omar@example.com", ""],
    ]);
  });
  it("detects semicolon and tab exports and names blank or repeated headers", () => {
    expect(detectDelimiter("a;b;c\n1;2;3")).toBe(";");
    expect(detectDelimiter("a\tb\n1\t2")).toBe("\t");
    expect(csvRecords("Phone,,Phone\n1,2,3").headers).toEqual(["Phone", "Column 2", "Phone (2)"]);
  });
});

describe("field transforms", () => {
  it("normalises phone numbers to E.164 with the market's dialling code", () => {
    expect(normalisePhone("050 123 4567", "AE")).toBe("+971501234567");
    expect(normalisePhone("+44 7700 900123", "AE")).toBe("+447700900123");
    expect(normalisePhone("0091 98200 12345", "AE")).toBe("+919820012345");
    expect(normalisePhone("98200 12345", "IN")).toBe("+919820012345");
    expect(normalisePhone("12", "AE")).toBeNull();
  });
  it("reads amounts in CRM formats, including lakh and crore", () => {
    expect(parseAmount("AED 2,450,000")).toBe(2_450_000);
    expect(parseAmount("1.2M")).toBe(1_200_000);
    expect(parseAmount("8.6 Cr")).toBe(86_000_000);
    expect(parseAmount("50 L")).toBe(5_000_000);
    expect(parseAmount("£950k")).toBe(950_000);
    expect(parseAmount("n/a")).toBeNull();
  });
  it("reads ISO, day-first, month-first-when-unambiguous and epoch dates", () => {
    expect(parseDate("2026-03-14")?.toISOString().slice(0, 10)).toBe("2026-03-14");
    expect(parseDate("14/03/2026")?.toISOString().slice(0, 10)).toBe("2026-03-14");
    expect(parseDate("03/14/2026")?.toISOString().slice(0, 10)).toBe("2026-03-14");
    expect(parseDate("1767225600")?.toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(parseDate("not a date")).toBeNull();
  });
});

describe("mapping", () => {
  const headers = ["First Name", "Last Name", "Email Address", "Mobile", "Lead Source", "Status", "Max Price", "Created Date", "Areas"];
  it("proposes a mapping from column names", () => {
    const m = Object.fromEntries(autoMap("leads", headers).map((r) => [r.targetField, r.sourceField]));
    expect(m).toMatchObject({ first_name: "First Name", last_name: "Last Name", email: "Email Address", phone: "Mobile", source: "Lead Source", stage: "Status", budget_max: "Max Price", created_at: "Created Date", location: "Areas" });
  });
  it("builds a lead, translating CRM vocabulary, and rejects unreachable records", () => {
    const rules = autoMap("leads", headers);
    const ok = buildLead(rules, { "First Name": "JANE", "Last Name": "doe", "Email Address": "Jane@Example.com", Mobile: "050 123 4567", "Lead Source": "Property Finder", Status: "Hot Prospect", "Max Price": "3.5M", "Created Date": "01/02/2026", Areas: "Dubai Marina; JLT" }, "AE", "website");
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.record).toMatchObject({ name: "Jane Doe", email: "jane@example.com", phone: "+971501234567", source: "propertyfinder", stage: "qualified", budgetMax: 3_500_000, locations: ["Dubai Marina", "Jlt"] });
    const bad = buildLead(rules, { "First Name": "No", "Last Name": "Contact" }, "AE", "website");
    expect(bad.ok).toBe(false);
  });
  it("applies a custom value map ahead of the built-in vocabulary", () => {
    const rules = [
      { sourceField: "n", targetField: "name", transform: "titlecase" as const },
      { sourceField: "e", targetField: "email", transform: "lowercase" as const },
      { sourceField: "st", targetField: "stage", transform: "value_map" as const, valueMap: { "Stage 4": "offer" } },
    ];
    const r = buildLead(rules, { n: "a b", e: "a@b.co", st: "Stage 4" }, "GB", "website");
    expect(r.ok && r.record.stage).toBe("offer");
  });
  it("requires title, price, city and area for a listing", () => {
    const rules = autoMap("listings", ["Title", "Price", "City", "Size", "Beds", "Permit Number"]);
    expect(buildListing(rules, { Title: "Two-bedroom", Price: "2,400,000", City: "Dubai", Size: "1,280", Beds: "2", "Permit Number": "7120345611" }, "AE").ok).toBe(true);
    expect(buildListing(rules, { Title: "No price", City: "Dubai", Size: "900" }, "AE").ok).toBe(false);
  });
});

describe("source adapters", () => {
  it("flattens nested CRM records into dotted fields", () => {
    expect(flatten({ id: 7, emails: [{ value: "a@b.co" }], tags: ["Buyer", "VIP"], attributes: { type: "Lead" } })).toEqual({ id: "7", "emails.0.value": "a@b.co", tags: "Buyer; VIP" });
  });
  it("pages through Follow Up Boss with basic authentication", async () => {
    const calls: { url: string; auth: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, auth: new Headers(init.headers).get("authorization") });
      return new Response(JSON.stringify({ _metadata: { total: 3, offset: 0, limit: 100 }, people: [{ id: 1, firstName: "A" }, { id: 2, firstName: "B" }] }), { headers: { "content-type": "application/json" } });
    });
    const page = await SOURCES.followupboss.extract!({ apiKey: "fub_key_123" }, "leads", null);
    expect(page.records.map((r) => r.externalId)).toEqual(["1", "2"]);
    expect(page.next).toBe("2");
    expect(calls[0]!.url).toContain("offset=0");
    expect(calls[0]!.auth).toBe(`Basic ${Buffer.from("fub_key_123:").toString("base64")}`);
  });
  it("reports a rejected key with the provider's name and status", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ errorMessage: "Invalid API key" }), { status: 401 }));
    await expect(SOURCES.kvcore.extract!({ apiKey: "bad-token-1" }, "leads", null)).rejects.toThrow(/kvCORE: rejected the credentials \(401\)/);
  });
  it("keys Salesforce pages on Id so FIELDS(ALL) stays within its 200-row limit", async () => {
    let query = "";
    vi.stubGlobal("fetch", async (url: string) => {
      query = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
      return new Response(JSON.stringify({ totalSize: 1, records: [{ Id: "00Q1", FirstName: "Sam", attributes: {} }] }), { headers: { "content-type": "application/json" } });
    });
    const page = await SOURCES.salesforce.extract!({ accessToken: "t", instanceUrl: "https://acme.my.salesforce.com" }, "leads", "00Q0");
    expect(query).toBe("SELECT FIELDS(ALL) FROM Lead WHERE Id > '00Q0' ORDER BY Id LIMIT 200");
    expect(page.next).toBeNull();
  });
});

describe("credential vault", () => {
  it("round-trips sealed secrets and rejects tampering", () => {
    const sealed = seal({ apiKey: "secret-value" });
    expect(sealed).not.toContain("secret-value");
    expect(JSON.parse(open(sealed))).toEqual({ apiKey: "secret-value" });
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => open(parts.join("."))).toThrow();
  });
  it("signs OAuth state and refuses altered state", () => {
    const st = signState({ jobId: "j1", tenantId: "t1" });
    expect(verifyState<{ jobId: string }>(st)?.jobId).toBe("j1");
    expect(verifyState(st.replace(/.$/, (c) => (c === "A" ? "B" : "A")))).toBeNull();
  });
});

describe("import pipeline, end to end", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  beforeAll(async () => {
    env = await testDb();
  }, 120_000);

  it("imports Follow Up Boss people: connect, extract, map, dry run, load, de-duplicate and roll back", async () => {
    const { createJob, connect, extractStep, getJob, dryRun, loadStep, rollback } = await import("@/lib/migration/engine");
    const { db, a, ua } = env;
    // An existing lead the import must not duplicate.
    await db.insert(s.leads).values({ tenantId: a.id, reference: "LD-0007", name: "Existing", email: "dup@example.com", source: "website", market: "AE", intent: "buy", currency: "AED" });
    const people = Array.from({ length: 130 }, (_, i) => ({ id: 1000 + i, firstName: `Person${i}`, lastName: "Test", emails: [{ value: i === 5 ? "dup@example.com" : `p${i}@example.com` }], phones: [{ value: `050 ${String(1000000 + i)}` }], source: i % 2 ? "Zillow" : "Website", stage: i % 3 ? "Lead" : "Hot Prospect", price: 1_500_000 + i * 1000, created: "2026-01-15T10:00:00Z" }));
    people.push({ id: 9999, firstName: "", lastName: "", emails: [{ value: "" }], phones: [{ value: "" }], source: "Website", stage: "Lead", price: 0, created: "" });
    vi.stubGlobal("fetch", async (url: string) => {
      const offset = Number(new URL(url).searchParams.get("offset"));
      return new Response(JSON.stringify({ _metadata: { total: people.length, offset, limit: 100 }, people: people.slice(offset, offset + 100) }), { headers: { "content-type": "application/json" } });
    });
    const actor = { id: ua.id, name: ua.name };
    const job = await createJob(db, a.id, { source: "followupboss", entity: "leads", defaultMarket: "AE" }, actor);
    expect(job.reference).toBe("MG-0001");
    await connect(db, job, { apiKey: "fub_test_key" });
    let r;
    do r = await extractStep(db, await getJob(db, a.id, job.id));
    while (!r.done);
    const extracted = await getJob(db, a.id, job.id);
    expect(extracted.totals.staged).toBe(131);
    expect(extracted.status).toBe("mapping");
    expect(extracted.credentials).not.toContain("fub_test_key");

    const totals = await dryRun(db, extracted);
    expect(totals).toMatchObject({ processed: 131, created: 129, skipped: 1, failed: 1 });
    const before = await db.select().from(s.leads).where(eq(s.leads.tenantId, a.id));
    expect(before).toHaveLength(1);

    let load;
    do load = await loadStep(db, await getJob(db, a.id, job.id), actor);
    while (!load.done);
    expect(load.totals).toMatchObject({ created: 129, skipped: 1, failed: 1 });
    const leads = await db.select().from(s.leads).where(eq(s.leads.tenantId, a.id));
    expect(leads).toHaveLength(130);
    const hot = leads.find((l) => l.email === "p0@example.com")!;
    expect(hot).toMatchObject({ name: "Person0 Test", phone: "+971501000000", stage: "qualified", source: "website", sourceRef: "followupboss:1000" });
    expect(leads.find((l) => l.email === "p1@example.com")!.source).toBe("zillow");
    expect(new Set(leads.map((l) => l.reference)).size).toBe(130);

    const done = await getJob(db, a.id, job.id);
    expect(done.status).toBe("completed");
    expect(done.rollbackUntil!.getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    const undo = await rollback(db, done, actor);
    expect(undo.deleted).toBe(129);
    expect(await db.select().from(s.leads).where(eq(s.leads.tenantId, a.id))).toHaveLength(1);
    expect((await getJob(db, a.id, job.id)).status).toBe("rolled_back");
  }, 120_000);

  it("imports a CSV of listings and keeps them inside the importing firm", async () => {
    const { createJob, stageCsv, getJob, dryRun, loadStep } = await import("@/lib/migration/engine");
    const { db, a, b, ub } = env;
    const csv = "Title,Purpose,Type,Price,City,Community,Beds,Baths,Size,Permit\nTwo-bedroom apartment,For Sale,Apartment,\"2,400,000\",Dubai,Dubai Marina,2,3,1280,7120345611\nStudio,For Rent,Apartment,58000,Dubai,JVC,0,1,410,7120422190\nBroken row,,,,,,,,,\n";
    const job = await createJob(db, b.id, { source: "csv", entity: "listings", defaultMarket: "AE" }, { id: ub.id, name: ub.name });
    await stageCsv(db, job, csv, "listings.csv");
    const staged = await getJob(db, b.id, job.id);
    expect(staged.sourceFields).toContain("Permit");
    expect(await dryRun(db, staged)).toMatchObject({ created: 2, failed: 1 });
    let load;
    do load = await loadStep(db, await getJob(db, b.id, job.id), { id: ub.id, name: ub.name });
    while (!load.done);
    const rows = await db.select().from(s.listings).where(eq(s.listings.tenantId, b.id));
    expect(rows.map((l) => [l.purpose, l.price, l.permitNumber])).toEqual(
      expect.arrayContaining([
        ["sale", 2_400_000, "7120345611"],
        ["rent", 58_000, "7120422190"],
      ]),
    );
    expect(await db.select().from(s.listings).where(and(eq(s.listings.tenantId, a.id)))).toHaveLength(0);
    await expect(getJob(db, a.id, job.id)).rejects.toThrow(/not found/);
  }, 60_000);
});

describe("value-map helper", () => {
  it("lists a source field's most common values", async () => {
    const { db, a, ua } = await testDb();
    const { createJob, stageCsv, distinctValues } = await import("@/lib/migration/engine");
    const job = await createJob(db, a.id, { source: "csv", entity: "leads", defaultMarket: "AE" }, { id: ua.id, name: ua.name });
    await stageCsv(db, job, "Name,Email,Status\nA,a@x.co,Hot\nB,b@x.co,Hot\nC,c@x.co,Cold\n", "f.csv");
    expect(await distinctValues(db, job.id, "Status")).toEqual([
      { value: "Hot", n: 2 },
      { value: "Cold", n: 1 },
    ]);
  }, 60_000);
});
