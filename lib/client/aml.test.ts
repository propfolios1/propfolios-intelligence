import { describe, expect, it } from "vitest";
import { nameScore, screen } from "./aml";

describe("AML screening (mock provider)", () => {
  it("clears unrelated names", () => {
    expect(screen("Ahmed Al Mansoori", "sanctions").status).toBe("clear");
  });
  it("raises a potential match on a transliteration variant", () => {
    expect(nameScore("Khalid bin Rashid", "Khaled Bin Rashed Al Shamsi")).toBeGreaterThan(0.85);
    expect(screen("Khalid bin Rashid", "pep").status).toBe("potential_match");
  });
  it("confirms an exact match", () => {
    expect(screen("Marcus Delacroix", "adverse_media").status).toBe("confirmed_match");
  });
});
