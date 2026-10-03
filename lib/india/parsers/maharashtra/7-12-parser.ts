import { confidence, field, hectareAreToSqm, lines, normalise, numberIn, type ParseResult, scriptOf } from "../common";

/** 7/12 extract (Satbara Utara): Village Form VII (record of rights) and XII (crop record), Maharashtra Land Revenue Code 1966. */
export interface SevenTwelve {
  district: string | null;
  taluka: string | null;
  village: string | null;
  surveyNumber: string | null;
  subDivision: string | null;
  occupantClass: "Class I" | "Class II" | null;
  holders: { name: string; share: string | null }[];
  areaSqm: number | null;
  potKharabaSqm: number | null;
  assessmentInr: number | null;
  tenure: string | null;
  otherRights: string[];
  encumbrances: { kind: string; detail: string }[];
  mutationEntries: string[];
  landUse: "agricultural" | "non_agricultural" | null;
}

const L = {
  district: ["District", "जिल्हा", "Jilha"],
  taluka: ["Taluka", "तालुका", "Tahsil"],
  village: ["Village", "गाव", "Gaon", "Mauje", "मौजे"],
  survey: ["Survey No", "Survey Number", "S. No", "S.No", "Gat No", "Gat Number", "भूमापन क्रमांक", "सर्वे नं", "गट क्रमांक", "गट नं"],
  sub: ["Hissa No", "Sub Division", "Sub-Division", "उपविभाग", "हिस्सा क्रमांक", "हिस्सा"],
  area: ["Total Area", "Area", "एकूण क्षेत्र", "क्षेत्र"],
  pot: ["Pot Kharaba", "पोट खराबा"],
  assessment: ["Assessment", "आकारणी", "Akarni"],
  tenure: ["Tenure", "भूधारणा पद्धती", "धारणा"],
  holder: ["Name of Occupant", "Occupant", "Holder", "भोगवटादाराचे नाव", "भोगवटादार", "खातेदार"],
  other: ["Other Rights", "इतर अधिकार", "Itar Adhikar"],
  mutation: ["Mutation No", "Mutation Entry", "फेरफार क्रमांक", "फेरफार"],
};

const ENCUMBRANCE = [
  { kind: "Bank charge", re: /(bank|बँक|loan|कर्ज|बोजा|charge|mortgage|गहाण)/iu },
  { kind: "Tenancy (kul)", re: /(kul|कुळ|tenant|tenancy)/iu },
  { kind: "Government restriction", re: /(restricted|शर्तीची|नवीन शर्त|new tenure|inam|इनाम|वतन|watan)/iu },
  { kind: "Litigation", re: /(court|न्यायालय|dispute|वाद|stay|lis pendens)/iu },
  { kind: "Acquisition", re: /(acquisition|भूसंपादन|reserved|आरक्षण)/iu },
];

export function parse712(raw: string, opts: { ocr?: boolean } = {}): ParseResult<SevenTwelve> {
  const text = normalise(raw);
  const ls = lines(text);
  const warnings: string[] = [];
  const holders: SevenTwelve["holders"] = [];
  for (const l of ls) {
    if (L.holder.some((h) => l.toLowerCase().startsWith(h.toLowerCase()))) {
      const v = l.replace(new RegExp(`^(${L.holder.join("|")})\\s*[:\\-–]?\\s*`, "iu"), "");
      for (const part of v.split(/[,;]| and | व /u)) {
        const name = part.replace(/\(.*?\)/g, "").replace(/\d+(\.\d+)?\s*%?$/, "").trim();
        const share = /\((.*?)\)/.exec(part)?.[1] ?? null;
        if (name.length > 2) holders.push({ name, share });
      }
    }
  }
  const otherRights = ls.filter((l) => L.other.some((o) => l.toLowerCase().includes(o.toLowerCase()))).map((l) => l.replace(new RegExp(`^.*?(${L.other.join("|")})\\s*[:\\-–]?\\s*`, "iu"), "")).filter(Boolean);
  const encumbrances = ENCUMBRANCE.flatMap((e) => {
    const hit = [...otherRights, ...ls].find((l) => e.re.test(l));
    return hit ? [{ kind: e.kind, detail: hit.slice(0, 160) }] : [];
  });
  const classRaw = /(class|वर्ग)\s*[-:]?\s*(1|2|I{1,2}|१|२)\b/iu.exec(text)?.[2] ?? null;
  const occupantClass = classRaw ? (/^(1|I|१)$/.test(classRaw) ? "Class I" : "Class II") : null;
  const mutationEntries = [...text.matchAll(/(?:mutation|फेरफार)\s*(?:no\.?|क्र\.?|क्रमांक)?\s*[:\-]?\s*([\d,\s]+)/giu)].flatMap((m) => m[1].split(/[,\s]+/).filter(Boolean));
  const naHit = /(non[- ]agricultural|N\.?A\.?\s|अकृषिक|बिनशेती)/iu.test(text);
  const parsed: SevenTwelve = {
    district: field(text, L.district),
    taluka: field(text, L.taluka),
    village: field(text, L.village),
    surveyNumber: field(text, L.survey, "[0-9A-Za-z/]+"),
    subDivision: field(text, L.sub, "[0-9A-Za-z/]+"),
    occupantClass,
    holders,
    areaSqm: hectareAreToSqm(field(text, L.area, "[0-9.\\- ]+")),
    potKharabaSqm: hectareAreToSqm(field(text, L.pot, "[0-9.\\- ]+")),
    assessmentInr: numberIn(field(text, L.assessment)),
    tenure: field(text, L.tenure),
    otherRights,
    encumbrances,
    mutationEntries: [...new Set(mutationEntries)].slice(0, 20),
    landUse: naHit ? "non_agricultural" : /(agricultur|कृषि|शेती|crop|पीक)/iu.test(text) ? "agricultural" : null,
  };
  if (occupantClass === "Class II") warnings.push("Class II occupancy: transfer requires the Collector's prior permission and payment of nazrana.");
  for (const e of encumbrances) warnings.push(`${e.kind} recorded in other rights: ${e.detail}`);
  if (parsed.landUse === "agricultural") warnings.push("Agricultural land: only an agriculturist may purchase (Tenancy and Agricultural Lands Act 1948, s.63); NRIs and OCIs may not.");
  if (holders.length > 1) warnings.push(`${holders.length} holders recorded; every holder (or their legal heirs) must join the conveyance.`);
  const required = { district: parsed.district, village: parsed.village, surveyNumber: parsed.surveyNumber, holders: holders.length ? "y" : null, areaSqm: parsed.areaSqm };
  const missing = Object.entries(required).filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length) warnings.push(`Not found: ${missing.join(", ")}. Verify against the certified copy from Bhulekh Mahabhumi.`);
  return { recordType: "7_12", parsed, confidence: confidence(5 - missing.length, 5, text, Boolean(opts.ocr)), warnings, missing, script: scriptOf(raw) };
}
