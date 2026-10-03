import { describe, expect, it } from "vitest";
import { detectRecordType, parse712, parseComunidade, parseFormI, parsePropertyCard } from ".";
import { normalise } from "./common";
import { sample712, sampleComunidade, sampleFormI, samplePropertyCard } from "../samples";

describe("land record parsers", () => {
  it("normalises Devanagari digits and OCR confusions", () => {
    expect(normalise("सर्वे नं १२३/४")).toContain("123/4");
    expect(normalise("Area 1O.5 and 2l3")).toBe("Area 10.5 and 213");
  });

  it("parses a bilingual 7/12 extract and flags a bank charge and Class II occupancy", () => {
    const r = parse712(sample712({ district: "Mumbai Suburban", taluka: "Borivali", village: "Eksar", survey: "१४५", hissa: "2/1", area: "0.42.50", holders: "Ramesh Patil (1/2), Sunita Patil (1/2)", other: "बोजा: State Bank of India loan Rs. 40,00,000", mutation: "4521, 4876", classNo: 2 }));
    expect(r.recordType).toBe("7_12");
    expect(r.parsed.surveyNumber).toBe("145");
    expect(r.parsed.areaSqm).toBe(4250);
    expect(r.parsed.holders).toHaveLength(2);
    expect(r.parsed.occupantClass).toBe("Class II");
    expect(r.parsed.encumbrances.some((e) => e.kind === "Bank charge")).toBe(true);
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it("reads a property card tenure and undischarged mortgage", () => {
    const r = parsePropertyCard(samplePropertyCard({ division: "K-West", village: "Juhu", cts: "1123/A", sheet: "14", area: "1,842.6", tenure: "C (Collector's lease)", holder: "Seaview CHS Ltd", entries: ["12/03/1998 Conveyance deed in favour of Seaview CHS Ltd", "04/07/2019 Mortgage to HDFC Bank Ltd"] }));
    expect(r.parsed.ctsNumber).toBe("1123/A");
    expect(r.parsed.plotAreaSqm).toBeCloseTo(1842.6);
    expect(r.parsed.governmentLease).toBe(true);
    expect(r.parsed.encumbrances).toHaveLength(1);
  });

  it("parses Goa Form I and XIV with a mundkar", () => {
    const r = parseFormI(sampleFormI({ taluka: "Bardez", village: "Assagao", survey: "112", sub: "3", field: "Bhatt", area: "1,450", landClass: "Settlement", occupants: "Maria Fernandes, Joao Fernandes", tenant: "Nil", mundkar: "Anant Naik", other: "Nil", crop: "Uncultivable", mutation: "2210" }));
    expect(r.parsed.areaSqm).toBe(1450);
    expect(r.parsed.mundkars).toEqual(["Anant Naik"]);
    expect(r.parsed.tenants).toEqual([]);
    expect(r.warnings.some((w) => w.includes("Mundkar"))).toBe(true);
  });

  it("parses a Comunidade aforamento and detects record types", () => {
    const text = sampleComunidade({ comunidade: "Serula", aforamento: "AF-1187", plot: "41", foreiro: "Francis D'Souza", foro: "1,200", area: "600", gb: "14/02/1971", admin: "approved 02/05/1971", escritura: "18/06/1971", notary: "Notário de Mapusa", condition: "residential use only, not to alienate without consent" });
    const r = parseComunidade(text);
    expect(r.parsed.aforamentoNumber).toBe("AF-1187");
    expect(r.parsed.escrituraDate).toBe("1971-06-18");
    expect(r.warnings.some((w) => w.includes("non-alienation"))).toBe(true);
    expect(detectRecordType(text)).toBe("escritura");
  });
});
