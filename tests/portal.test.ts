import { afterEach, describe, expect, it } from "vitest";
import { nextSteps, readiness, type NextStepInput } from "@/lib/client/next-steps";
import { buildScene, paletteFor, pickIndex, sceneFor, subjectFor } from "@/lib/media/subjects";
import { clearUnsplashCache, photosFor, searchUnsplash, toPhoto } from "@/lib/media/unsplash";

const NOW = new Date("2026-10-16T08:00:00Z");
const day = (n: number) => new Date(NOW.getTime() + n * 86_400_000);
const clean: NextStepInput = { kyc: { status: "approved", expiresAt: day(400) }, contracts: [], invoices: [], reports: [], recommendations: [], goals: [] };

describe("next steps", () => {
  it("is empty and fully ready when nothing is outstanding", () => {
    expect(nextSteps(clean, NOW)).toEqual([]);
    expect(readiness(clean)).toEqual({ pct: 100, done: 4, total: 4 });
  });

  it("puts an overdue invoice and a missing verification above reading", () => {
    const steps = nextSteps(
      {
        ...clean,
        kyc: null,
        invoices: [{ id: "i1", number: "INV-1", status: "issued", total: 52_500, currency: "AED", dueAt: day(-3) }],
        reports: [{ id: "r1", title: "Q3 report", type: "quarterly", viewedAt: null, generatedAt: day(-2) }],
        contracts: [{ id: "c1", title: "SPA", status: "out_for_signature", deal: "Marina Shores 2BR" }],
      },
      NOW,
    );
    expect(steps.map((s) => s.kind)).toEqual(["kyc", "invoice", "contract", "report"]);
    expect(steps[1]!.title).toBe("Invoice INV-1 is overdue");
    expect(steps[1]!.detail).toBe("AED 52,500, 3 days past due.");
    expect(steps[1]!.tone).toBe("coral");
  });

  it("warns before verification lapses and ignores settled paperwork", () => {
    const steps = nextSteps({ ...clean, kyc: { status: "approved", expiresAt: day(10) }, contracts: [{ id: "c", title: "MOU", status: "signed", deal: "x" }], invoices: [{ id: "i", number: "INV-2", status: "paid", total: 1, currency: "AED", dueAt: day(-30) }] }, NOW);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.detail).toContain("10 days");
  });

  it("flags only goals that are behind with the deadline inside a year", () => {
    const steps = nextSteps({ ...clean, goals: [{ id: "g1", title: "Income of AED 450,000", progressPct: 30, by: "2027-03-31" }, { id: "g2", title: "Legacy", progressPct: 10, by: "2031-01-01" }, { id: "g3", title: "Growth", progressPct: 80, by: "2027-01-01" }] }, NOW);
    expect(steps.map((s) => s.id)).toEqual(["goal-g1"]);
  });

  it("scores readiness by obligation", () => {
    expect(readiness({ ...clean, reports: [{ id: "r", title: "t", type: "quarterly", viewedAt: null, generatedAt: NOW }] }).pct).toBe(75);
  });
});

describe("photographic subjects", () => {
  it("maps cities to scenes and falls back to a generic city", () => {
    expect(sceneFor("Dubai")).toBe("dubai");
    expect(sceneFor(" abu dhabi ")).toBe("abu-dhabi");
    expect(sceneFor("Vagator")).toBe("goa");
    expect(sceneFor("Reykjavik")).toBe("city");
  });

  it("chooses searches by asset type, then community, then city", () => {
    expect(subjectFor({ seed: "a", city: "Dubai", community: "Arabian Ranches", kind: "Villa" }).query).toBe("luxury villa pool");
    expect(subjectFor({ seed: "b", city: "Dubai", community: "Dubai Marina", kind: "Residential" }).query).toBe("dubai marina");
    expect(subjectFor({ seed: "c", city: "Mumbai", community: "Andheri", kind: "Residential" }).query).toBe("mumbai skyline");
    expect(subjectFor({ seed: "d", city: "Goa", community: "Assagao", kind: "Villa" }).query).toBe("goa villa pool");
    expect(subjectFor({ seed: "e", city: "Lisbon", community: "Chiado", kind: "Residential" }).query).toBe("lisbon architecture");
  });

  it("draws the same scene for the same property and keeps it on the canvas", () => {
    const a = buildScene("marina-shores", "dubai");
    expect(buildScene("marina-shores", "dubai")).toEqual(a);
    expect(buildScene("other", "dubai")).not.toEqual(a);
    for (const b of a.buildings) expect(a.horizon - b.h).toBeGreaterThan(0);
    const wide = buildScene("x", "london", 1000);
    expect(wide.buildings.at(-1)!.x).toBeGreaterThan(900);
    expect(["golden", "day", "night"]).toContain(paletteFor("dubai", "x").mood);
  });

  it("picks indexes in range, stably", () => {
    expect(pickIndex("seed", 0)).toBe(-1);
    const i = pickIndex("seed", 7);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(7);
    expect(pickIndex("seed", 7)).toBe(i);
  });
});

describe("Unsplash", () => {
  afterEach(() => clearUnsplashCache());
  const api = (id: string, extra: Record<string, unknown> = {}) => ({ id, width: 4000, height: 2667, color: "#a0b0c0", alt_description: "city skyline at dusk", description: null, urls: { raw: `https://images.unsplash.com/photo-${id}?ixid=abc` }, links: { html: `https://unsplash.com/photos/${id}` }, user: { name: "Jane Doe", links: { html: "https://unsplash.com/@jane" } }, ...extra });

  it("keeps the ixid, credits the photographer with referral links and drops premium images", () => {
    const p = toPhoto(api("1"))!;
    expect(p.src).toBe("https://images.unsplash.com/photo-1?ixid=abc");
    expect(p.alt).toBe("City skyline at dusk");
    expect(p.author.profileUrl).toBe("https://unsplash.com/@jane?utm_source=nakhla&utm_medium=referral");
    expect(p.pageUrl).toContain("utm_medium=referral");
    expect(toPhoto(api("2", { premium: true }))).toBeNull();
    expect(toPhoto(api("3", { urls: { raw: "https://plus.unsplash.com/premium_photo-3" } }))).toBeNull();
  });

  it("makes no request without a key", async () => {
    let calls = 0;
    expect(await searchUnsplash("dubai skyline", { key: "", fetcher: async () => (calls++, new Response("{}")) })).toEqual([]);
    expect(calls).toBe(0);
  });

  it("searches once per query, authenticates, and gives two properties different photographs", async () => {
    const urls: string[] = [];
    let auth = "";
    const fetcher = async (u: string, init?: RequestInit) => {
      urls.push(u);
      auth = new Headers(init?.headers).get("authorization") ?? "";
      return new Response(JSON.stringify({ results: [api("a"), api("b"), api("c")] }), { status: 200 });
    };
    const out = await photosFor(
      [
        { seed: "p1", query: "dubai skyline", scene: "dubai" },
        { seed: "p2", query: "dubai skyline", scene: "dubai" },
      ],
      { key: "k", fetcher },
    );
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("orientation=landscape");
    expect(urls[0]).toContain("content_filter=high");
    expect(auth).toBe("Client-ID k");
    expect(out.get("p1")!.id).not.toBe(out.get("p2")!.id);
  });

  it("returns nothing when the API fails, so the illustration is drawn", async () => {
    const out = await photosFor([{ seed: "p", query: "london skyline", scene: "london" }], { key: "k", fetcher: async () => new Response("rate limited", { status: 403 }) });
    expect(out.get("p")).toBeNull();
  });
});
