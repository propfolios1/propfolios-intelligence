import { parseComunidade } from "./goa/comunidade-parser";
import { parseFormI } from "./goa/form-i-parser";
import { parse712 } from "./maharashtra/7-12-parser";
import { parsePropertyCard } from "./maharashtra/property-card-parser";

export { parse712, parsePropertyCard, parseFormI, parseComunidade };
export type { ParseResult } from "./common";

export type LandRecordKind = "7_12" | "property_card" | "form_i_xiv" | "escritura";

export const PARSERS = { "7_12": parse712, property_card: parsePropertyCard, form_i_xiv: parseFormI, escritura: parseComunidade } as const;

export const RECORD_LABEL: Record<LandRecordKind, string> = { "7_12": "7/12 extract", property_card: "Property card", form_i_xiv: "Form I and XIV", escritura: "Comunidade / Escritura" };

/** Detects the record type from its content when the uploader did not say. */
export function detectRecordType(text: string): LandRecordKind | null {
  if (/(7\s*\/\s*12|satbara|सातबारा|गाव नमुना सात|village form vii)/iu.test(text)) return "7_12";
  if (/(property card|मालमत्ता पत्रक|c\.?t\.?s\.? no|न\.भू\.क्र)/iu.test(text)) return "property_card";
  if (/(form i\b|form i & xiv|form i and xiv|form xiv|record of rights.*goa)/iu.test(text)) return "form_i_xiv";
  if (/(comunidade|aforamento|escritura)/iu.test(text)) return "escritura";
  return null;
}

export function parseLandRecord(text: string, kind?: LandRecordKind | null, opts: { ocr?: boolean } = {}) {
  const k = kind ?? detectRecordType(text);
  if (!k) return null;
  return PARSERS[k](text, opts);
}
