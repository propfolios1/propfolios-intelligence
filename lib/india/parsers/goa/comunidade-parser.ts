import { confidence, datesIn, field, normalise, numberIn, type ParseResult, scriptOf } from "../common";

/** Comunidade aforamento (perpetual lease) records and Escritura (notarial deed) extracts, often in Portuguese. */
export interface ComunidadeRecord {
  comunidade: string | null;
  aforamentoNumber: string | null;
  plotNumber: string | null;
  foreiro: string | null;
  foroAnnualInr: number | null;
  areaSqm: number | null;
  generalBodyResolution: string | null;
  administratorApproval: string | null;
  escrituraDate: string | null;
  notary: string | null;
  conditions: string[];
}

const L = {
  comunidade: ["Comunidade of", "Comunidade de", "Comunidade"],
  aforamento: ["Aforamento No", "Aforamento", "Lease No"],
  plot: ["Plot No", "Lote", "Plot"],
  foreiro: ["Foreiro", "Lessee", "Aforado a", "Granted to"],
  foro: ["Foro", "Annual Foro", "Annual rent", "Pensão anual"],
  area: ["Area", "Área", "Superfície"],
  gb: ["General Body", "Assembleia Geral", "Resolution of the General Body"],
  admin: ["Administrator of Comunidades", "Administrador das Comunidades", "Administrator"],
  notary: ["Notary", "Notário", "Tabelião"],
  escritura: ["Escritura", "Deed dated", "Escritura de"],
};

export function parseComunidade(raw: string, opts: { ocr?: boolean } = {}): ParseResult<ComunidadeRecord> {
  const text = normalise(raw);
  const warnings: string[] = [];
  const conditions = [...text.matchAll(/(?:condition|condição|clause|cláusula)\s*[:\-]?\s*([^\n]+)/giu)].map((m) => m[1].trim());
  const escrituraLine = field(text, L.escritura);
  const parsed: ComunidadeRecord = {
    comunidade: field(text, L.comunidade, "[A-Za-zÀ-ÿ ]+"),
    aforamentoNumber: field(text, L.aforamento, "[0-9A-Za-z/\\-]+"),
    plotNumber: field(text, L.plot, "[0-9A-Za-z/\\-]+"),
    foreiro: field(text, L.foreiro),
    foroAnnualInr: numberIn(field(text, L.foro)),
    areaSqm: numberIn(field(text, L.area, "[0-9.,]+")),
    generalBodyResolution: field(text, L.gb),
    administratorApproval: field(text, L.admin),
    escrituraDate: escrituraLine ? datesIn(escrituraLine)[0] ?? null : null,
    notary: field(text, L.notary),
    conditions,
  };
  if (!parsed.generalBodyResolution) warnings.push("No General Body resolution found: an aforamento without it is voidable.");
  if (!parsed.administratorApproval) warnings.push("No approval of the Administrator of Comunidades found: required for the grant and for any transfer.");
  if (conditions.some((c) => /(residential only|não alienar|not to alienate|reversion|reversão)/iu.test(c))) warnings.push("Grant contains a non-alienation or reversion condition; transfer may forfeit the plot to the Comunidade.");
  if (/(occupied|ocupado|encroach)/iu.test(text)) warnings.push("Record mentions occupation or encroachment of the plot.");
  const required = { comunidade: parsed.comunidade, aforamentoNumber: parsed.aforamentoNumber, foreiro: parsed.foreiro, areaSqm: parsed.areaSqm, plotNumber: parsed.plotNumber };
  const missing = Object.entries(required).filter(([, v]) => v === null).map(([k]) => k);
  return { recordType: "escritura", parsed, confidence: confidence(5 - missing.length, 5, text, Boolean(opts.ocr)), warnings, missing, script: scriptOf(raw) };
}
