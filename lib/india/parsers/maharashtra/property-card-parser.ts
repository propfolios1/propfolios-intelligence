import { confidence, datesIn, field, lines, normalise, numberIn, type ParseResult, scriptOf } from "../common";

/** Property card (Malmatta Patrak) issued by the City Survey Office for CTS-surveyed urban land in Mumbai. */
export interface PropertyCard {
  division: string | null;
  village: string | null;
  ctsNumber: string | null;
  sheetNumber: string | null;
  plotAreaSqm: number | null;
  tenure: string | null;
  holder: string | null;
  lessee: string | null;
  encumbrances: string[];
  entries: { date: string | null; transaction: string }[];
  governmentLease: boolean;
}

const L = {
  division: ["Division", "विभाग", "Ward"],
  village: ["Village", "गाव", "Mouje", "मौजे"],
  cts: ["C.T.S. No", "CTS No", "CTS Number", "City Survey No", "न.भू.क्र", "नगर भूमापन क्रमांक", "सि.स.नं"],
  sheet: ["Sheet No", "शीट क्रमांक", "शीट नं"],
  area: ["Area (sq. m)", "Area sq m", "Area", "क्षेत्र (चौ.मी.)", "क्षेत्रफळ", "क्षेत्र"],
  tenure: ["Tenure", "धारणाधिकार", "धारणा"],
  holder: ["Holder", "Name of Holder", "धारक", "धारकाचे नाव"],
  lessee: ["Lessee", "पट्टेदार"],
};

/** Tenure codes on Mumbai property cards. */
const TENURE: Record<string, string> = {
  A: "A: freehold (government grant without conditions)",
  B: "B: held under a special grant from government",
  C: "C: Collector's lease or other restricted tenure",
  D: "D: government land held on lease",
  "C-1": "C-1: occupancy with restrictions on transfer",
  E: "E: government land, unassigned",
  F: "F: private land subject to government conditions",
  G: "G: tenure unresolved",
};

export function parsePropertyCard(raw: string, opts: { ocr?: boolean } = {}): ParseResult<PropertyCard> {
  const text = normalise(raw);
  const warnings: string[] = [];
  const tenureRaw = field(text, L.tenure, "[A-G](?:-1)?\\b[^\\n]*");
  const code = tenureRaw ? /^([A-G](?:-1)?)/.exec(tenureRaw)?.[1] ?? null : null;
  const entries = lines(text)
    .filter((l) => datesIn(l).length && /(sale|conveyance|mortgage|lease|gift|will|heirship|transfer|विक्री|गहाण|बक्षीस|वारस|हस्तांतर|deed)/iu.test(l))
    .map((l) => ({ date: datesIn(l)[0] ?? null, transaction: l.replace(/\s+/g, " ").slice(0, 200) }));
  const encumbrances = entries.filter((e) => /(mortgage|charge|गहाण|बोजा|lien|attachment|जप्ती)/iu.test(e.transaction) && !/(released|discharged|मुक्त|redeemed)/iu.test(e.transaction)).map((e) => e.transaction);
  const parsed: PropertyCard = {
    division: field(text, L.division),
    village: field(text, L.village),
    ctsNumber: field(text, L.cts, "[0-9A-Za-z/\\-]+"),
    sheetNumber: field(text, L.sheet, "[0-9A-Za-z/]+"),
    plotAreaSqm: numberIn(field(text, L.area, "[0-9.,]+")),
    tenure: code ? TENURE[code] ?? tenureRaw : tenureRaw,
    holder: field(text, L.holder),
    lessee: field(text, L.lessee),
    encumbrances,
    entries,
    governmentLease: code === "C" || code === "D" || /(lease|पट्टा)/iu.test(field(text, L.tenure) ?? ""),
  };
  if (parsed.governmentLease) warnings.push("Government or Collector lease tenure: transfer needs the lessor's consent and an unearned-income charge.");
  if (code === "G") warnings.push("Tenure G (unresolved): title cannot be relied on until the City Survey Officer decides the tenure.");
  for (const e of encumbrances) warnings.push(`Undischarged charge on the card: ${e}`);
  if (entries.length && !entries.some((e) => /(sale|conveyance|विक्री)/iu.test(e.transaction))) warnings.push("No sale or conveyance entry found; check how the current holder acquired title.");
  const required = { ctsNumber: parsed.ctsNumber, village: parsed.village, plotAreaSqm: parsed.plotAreaSqm, holder: parsed.holder, tenure: parsed.tenure };
  const missing = Object.entries(required).filter(([, v]) => v === null).map(([k]) => k);
  if (missing.length) warnings.push(`Not found: ${missing.join(", ")}. Obtain a certified copy from the City Survey Office.`);
  return { recordType: "property_card", parsed, confidence: confidence(5 - missing.length, 5, text, Boolean(opts.ocr)), warnings, missing, script: scriptOf(raw) };
}
