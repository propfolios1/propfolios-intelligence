import { describe, expect, it } from "vitest";
import { DOCS } from "@/lib/docs/content";
import { PLANS } from "@/lib/plans";
import { SEGMENTS, segmentBySlug } from "@/lib/segments";

describe("segment pages", () => {
  it("covers the four firm sizes with a plan and complete content", () => {
    expect(SEGMENTS.map((s) => s.slug)).toEqual(["small-brokerages", "mid-size-brokerages", "enterprise-brokerages", "franchises"]);
    for (const s of SEGMENTS) {
      expect(PLANS.some((p) => p.id === s.plan)).toBe(true);
      expect(s.pains).toHaveLength(3);
      expect(s.flow).toHaveLength(4);
      expect(s.included).toHaveLength(6);
      expect(JSON.stringify(s)).not.toMatch(/!|revolutionary|cutting-edge|seamless|next-generation/i);
    }
    expect(segmentBySlug("nope")).toBeNull();
  });
  it("links only to pages that exist", () => {
    const pages = new Set(["/pricing", "/faq", "/security", "/docs/api", ...DOCS.map((d) => `/docs/${d.slug}`)]);
    for (const s of SEGMENTS) for (const x of s.included) expect(pages.has(x.href), `${s.slug}: ${x.href}`).toBe(true);
  });
  it("matches small firms to Starter's agent allowance", () => {
    const starter = PLANS.find((p) => p.id === "starter")!;
    expect(segmentBySlug("small-brokerages")!.size).toContain(String(starter.seats));
  });
});
