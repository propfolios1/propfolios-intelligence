import { confidence, field, lines, normalise, numberIn, type ParseResult, scriptOf } from "../common";

/** Form I and XIV: the Goa record of rights (survey record and crop/tenancy record). */
export interface FormIXiv {
  taluka: string | null;
  village: string | null;
  surveyNumber: string | null;
  subDivision: string | null;
  fieldName: string | null;
  areaSqm: number | null;
  landClass: string | null;
  occupants: string[];
  tenants: string[];
  mundkars: string[];
  otherRights: string[];
  cultivation: string | null;
  mutationNumbers: string[];
}

const L = {
  taluka: ["Taluka", "Taluca", "तालुका", "Concelho"],
  village: ["Village", "Aldeia", "गांव", "गाव"],
  survey: ["Survey No", "Survey Number", "S. No", "Sy. No"],
  sub: ["Sub-Div No", "Sub Division No", "Sub Div", "Sub-Division", "Sub. Div. No"],
  field: ["Name of the field", "Field Name", "Name of Field", "Nome da propriedade"],
  area: ["Total Area", "Area (sq. mts)", "Area (sq m)", "Area"],
  landClass: ["Class of land", "Land Class", "Classification"],
  occupant: ["Name of the Occupant", "Occupant", "Name of Occupant", "Occupants"],
  tenant: ["Name of Tenant", "Tenant", "Kul", "कुळ"],
  mundkar: ["Mundkar", "मुंडकार"],
  other: ["Other Rights", "Other rights and encumbrances", "Encumbrances"],
  crop: ["Crop", "Cultivation", "Uncultivable", "Cultivable"],
};

function names(text: string, labels: string[]) {
  const v = field(text, labels);
  if (!v || /^(nil|none|n\.?a\.?|-|—)$/i.test(v.trim())) return [];
  return v.split(/[,;]| and | e /).map((s) => s.replace(/\(.*?\)/g, "").trim()).filter((s) => s.length > 2 && !/^(nil|none)$/i.test(s));
}

export function parseFormI(raw: string, opts: { ocr?: boolean } = {}): ParseResult<FormIXiv> {
  const text = normalise(raw);
  const warnings: string[] = [];
  const otherRights = lines(text).filter((l) => L.other.some((o) => l.toLowerCase().startsWith(o.toLowerCase()))).map((l) => l.replace(/^[^:]*:\s*/, "")).filter((v) => !/^(nil|none)$/i.test(v));
  const parsed: FormIXiv = {
    taluka: field(text, L.taluka),
    village: field(text, L.village),
    surveyNumber: field(text, L.survey, "[0-9A-Za-z/]+"),
    subDivision: field(text, L.sub, "[0-9A-Za-z/\\-]+"),
    fieldName: field(text, L.field),
    areaSqm: numberIn(field(text, L.area, "[0-9.,]+")),
    landClass: field(text, L.landClass),
    occupants: names(text, L.occupant),
    tenants: names(text, L.tenant),
    mundkars: names(text, L.mundkar),
    otherRights,
    cultivation: field(text, L.crop),
    mutationNumbers: [...text.matchAll(/mutation\s*(?:no\.?)?\s*[:\-]?\s*(\d+)/gi)].map((m) => m[1]),
  };
  if (parsed.tenants.length) warnings.push(`Tenant (kul) recorded: ${parsed.tenants.join(", ")}. Tenants hold purchase rights under the Goa Agricultural Tenancy Act 1964; obtain a Mamlatdar's certificate before the sale.`);
  if (parsed.mundkars.length) warnings.push(`Mundkar recorded: ${parsed.mundkars.join(", ")}. The mundkar's dwelling right survives a sale (Mundkars Act 1975).`);
  if (/(paddy|khazan|agricultur|orchard|coconut|cashew)/i.test(`${parsed.landClass ?? ""} ${parsed.cultivation ?? ""}`)) warnings.push("Record shows agricultural, orchard or khazan use: conversion under s.32 of the Land Revenue Code is required, and NRIs and OCIs cannot buy.");
  if (/(comunidade)/i.test(text)) warnings.push("The Comunidade is shown as occupant or in other rights; read the aforamento grant before relying on this record.");
  if (parsed.occupants.length > 2) warnings.push(`${parsed.occupants.length} co-occupants recorded: confirm every heir joins (inventory proceedings).`);
  for (const o of otherRights) warnings.push(`Other rights: ${o}`);
  const required = { village: parsed.village, surveyNumber: parsed.surveyNumber, areaSqm: parsed.areaSqm, occupants: parsed.occupants.length ? "y" : null, taluka: parsed.taluka };
  const missing = Object.entries(required).filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length) warnings.push(`Not found: ${missing.join(", ")}. Obtain a fresh copy from the Mamlatdar or the DSLR portal.`);
  return { recordType: "form_i_xiv", parsed, confidence: confidence(5 - missing.length, 5, text, Boolean(opts.ocr)), warnings, missing, script: scriptOf(raw) };
}
