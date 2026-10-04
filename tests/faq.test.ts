import { describe, expect, it } from "vitest";
import { FAQS, faqJsonLd } from "@/lib/faq";

describe("FAQ", () => {
  it("has twelve questions in house style", () => {
    expect(FAQS).toHaveLength(12);
    expect(new Set(FAQS.map((f) => f.q)).size).toBe(12);
    for (const f of FAQS) {
      expect(f.q.endsWith("?")).toBe(true);
      expect(f.a).not.toMatch(/!|revolutionary|cutting-edge|seamless|next-generation/i);
    }
  });
  it("publishes schema.org FAQPage data", () => {
    const j = faqJsonLd();
    expect(j["@type"]).toBe("FAQPage");
    expect(j.mainEntity).toHaveLength(12);
    expect(j.mainEntity[0]).toMatchObject({ "@type": "Question", acceptedAnswer: { "@type": "Answer" } });
  });
  it("quotes the live plan price and the portals from the market registry", () => {
    expect(FAQS.find((f) => f.q.startsWith("What does it cost"))!.a).toMatch(/AED 1,500 a month for up to 10 agents/);
    expect(FAQS.find((f) => f.q.startsWith("Which property portals"))!.a).toMatch(/Bayut, Property Finder, Dubizzle/);
  });
});
