import "server-only";
import type { DB } from "@/db";
import { dcprCheck, GOA_RATES, CRZ_RULES, RP2021_ZONES } from "@/lib/regulations";
import { type IndiaContext, loadIndiaContext } from "./context";
import { READY_RECKONER } from "./ready-reckoner";

/**
 * India data sources. Each adapter mirrors one official register and
 * returns the same shape. None of these registers offers a public API, so
 * every adapter runs in "mock" mode over the workspace's seeded records; a
 * live adapter (licensed data vendor or a portal integration) replaces
 * `lookup` without changing callers.
 */

export type SourceMode = "mock" | "live";
export interface SourceResult {
  source: SourceId;
  label: string;
  authority: string;
  mode: SourceMode;
  asOf: string;
  found: boolean;
  summary: string;
  data: Record<string, unknown>;
  flags: string[];
}

interface SourceDef {
  id: SourceId;
  label: string;
  state: "MH" | "GA";
  authority: string;
  portal: string;
  covers: string;
  read: (c: IndiaContext) => Omit<SourceResult, "source" | "label" | "authority" | "mode" | "asOf">;
}

export const SOURCE_IDS = ["maharera", "igr-maharashtra", "ready-reckoner", "satbara", "property-card", "cts", "society", "mcgm", "mhada-sra", "dcpr", "goa-rera", "goa-registration", "goa-land-use", "rp2021", "comunidade", "mundkar", "form-i-xiv", "crz", "escritura"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const none = (summary: string) => ({ found: false, summary, data: {}, flags: [] as string[] });
const landOf = (c: IndiaContext, type: string) => c.land.find((l) => l.recordType === type) ?? null;

function reraRead(c: IndiaContext, authority: "MahaRERA" | "Goa RERA") {
  const r = c.record;
  if (!r || r.reraAuthority !== authority) return none(`No ${authority} registration on file for this project.`);
  const open = c.complaints.filter((x) => x.status !== "disposed" && x.status !== "withdrawn" && x.authority === authority);
  const flags: string[] = [];
  if (r.reraStatus === "lapsed" || r.reraStatus === "revoked") flags.push(`Registration ${r.reraStatus}: the project cannot be marketed (RERA 2016, s.3).`);
  if (r.reraStatus === "extended") flags.push("Registration extended under s.6: possession was delayed beyond the original declared date.");
  if (r.reraValidUntil && new Date(r.reraValidUntil) < new Date(Date.now() + 180 * 86_400_000) && r.reraStatus !== "completed") flags.push(`Registration expires on ${r.reraValidUntil}; an extension application is due.`);
  if (open.length >= 3) flags.push(`${open.length} open complaints against the developer before ${authority}.`);
  return {
    found: true,
    summary: `${r.reraNumber}: ${r.reraStatus}${r.reraValidUntil ? `, valid to ${r.reraValidUntil}` : ""}. ${c.complaints.filter((x) => x.authority === authority).length} complaints against ${c.developer?.name ?? "the developer"}, ${open.length} open.`,
    data: { reraNumber: r.reraNumber, status: r.reraStatus, validUntil: r.reraValidUntil, promoter: c.developer?.name, complaints: c.complaints.filter((x) => x.authority === authority).map((x) => ({ number: x.complaintNumber, filedOn: x.filedOn, category: x.category, status: x.status, outcome: x.outcome })) },
    flags,
  };
}

export const SOURCES: Record<SourceId, SourceDef> = {
  maharera: { id: "maharera", label: "MahaRERA", state: "MH", authority: "Maharashtra Real Estate Regulatory Authority", portal: "https://maharera.maharashtra.gov.in", covers: "Project registration, validity, quarterly filings, complaints and orders", read: (c) => reraRead(c, "MahaRERA") },
  "igr-maharashtra": {
    id: "igr-maharashtra", label: "IGR Maharashtra (Index II)", state: "MH", authority: "Inspector General of Registration and Controller of Stamps", portal: "https://igrmaharashtra.gov.in", covers: "Registered sale transactions (Index II), stamp duty paid",
    read: (c) => {
      const rows = c.txs.filter((t) => /IGR/.test(t.source));
      if (!rows.length) return none("No registered transactions found for this building.");
      const med = [...rows].sort((a, b) => a.pricePerSqft - b.pricePerSqft)[Math.floor(rows.length / 2)]!.pricePerSqft;
      return { found: true, summary: `${rows.length} registered sales in six months; median ${inr(med)} per sq ft.`, data: { transactions: rows.map((t) => ({ date: t.transactedAt, consideration: t.price, areaSqft: t.areaSqft, pricePerSqft: t.pricePerSqft, stampDutyPaid: Math.round(t.price * 0.06) })) }, flags: [] };
    },
  },
  "ready-reckoner": {
    id: "ready-reckoner", label: "Ready Reckoner", state: "MH", authority: "Department of Registration and Stamps, Maharashtra", portal: "https://igrmaharashtra.gov.in/ASR", covers: "Annual Statement of Rates by zone and sub-zone",
    read: (c) => {
      const r = c.record;
      if (!r?.readyReckonerRate) return none("No Ready Reckoner zone mapped for this property.");
      const market = c.property.pricePerSqft * 10.764;
      const ratio = r.readyReckonerRate / market;
      const zone = READY_RECKONER.find((z) => z.zone === r.readyReckonerZone);
      return { found: true, summary: `${r.readyReckonerZone} (${r.readyReckonerYear}): ${inr(r.readyReckonerRate)} per sq m, ${(ratio * 100).toFixed(0)}% of the asking rate.`, data: { zone: r.readyReckonerZone, year: r.readyReckonerYear, ratePerSqm: r.readyReckonerRate, askingPerSqm: Math.round(market), ratio: +ratio.toFixed(2), zoneTable: zone ?? null }, flags: ratio > 0.9 ? ["Asking price within 10% of the Ready Reckoner rate: stamp duty may be charged on the government value, and s.50C or s.56(2)(x) applies to any shortfall."] : [] };
    },
  },
  satbara: {
    id: "satbara", label: "7/12 extract (Bhulekh)", state: "MH", authority: "Revenue Department, Mahabhumi", portal: "https://bhulekh.mahabhumi.gov.in", covers: "Record of rights for surveyed land: holders, area, other rights, mutations",
    read: (c) => {
      const l = landOf(c, "7_12");
      if (!l) return none("No 7/12 extract on file. Mumbai island and suburban properties are usually on CTS property cards instead.");
      return { found: true, summary: `Survey ${String(l.parsed.surveyNumber ?? "")}, ${l.warnings.length} findings, parse confidence ${(l.confidence * 100).toFixed(0)}%.`, data: l.parsed, flags: l.warnings };
    },
  },
  "property-card": {
    id: "property-card", label: "Property card", state: "MH", authority: "City Survey Office, Mumbai", portal: "https://mahabhumi.gov.in", covers: "Urban title record by CTS number: holder, tenure, entries",
    read: (c) => {
      const l = landOf(c, "property_card");
      if (!l) return none("No property card on file.");
      return { found: true, summary: `CTS ${String(l.parsed.ctsNumber ?? "")}: ${String(l.parsed.tenure ?? "tenure not read")}.`, data: l.parsed, flags: l.warnings };
    },
  },
  cts: {
    id: "cts", label: "CTS survey", state: "MH", authority: "City Survey Office, Mumbai", portal: "https://mahabhumi.gov.in", covers: "City Survey number, village and plot boundaries",
    read: (c) => (c.record?.ctsNumber ? { found: true, summary: `CTS ${c.record.ctsNumber}, village ${c.record.village}, ${c.record.district}.`, data: { cts: c.record.ctsNumber, village: c.record.village, district: c.record.district }, flags: [] } : none("No CTS number recorded.")),
  },
  society: {
    id: "society", label: "Society records", state: "MH", authority: "Co-operative housing society / Deputy Registrar", portal: "https://sahakarayukta.maharashtra.gov.in", covers: "Society registration, share certificate, NOC status, conveyance",
    read: (c) => {
      const r = c.record;
      if (!r?.societyName) return none("No co-operative society: the project is sold by the promoter under a RERA agreement.");
      const flags = r.societyNocStatus === "refused" ? ["Society has refused the NOC; the transfer cannot proceed."] : r.societyNocStatus === "pending" ? ["Society NOC pending."] : [];
      return { found: true, summary: `${r.societyName}: NOC ${r.societyNocStatus?.replace("_", " ") ?? "not requested"}.`, data: { society: r.societyName, nocStatus: r.societyNocStatus }, flags };
    },
  },
  mcgm: {
    id: "mcgm", label: "MCGM building approvals", state: "MH", authority: "Municipal Corporation of Greater Mumbai, Building Proposals", portal: "https://autodcr.mcgm.gov.in", covers: "IOD, commencement certificate, occupation certificate, fire NOC",
    read: (c) => {
      const a = c.record?.mcgmApprovals;
      if (!a) return none("No MCGM approval data on file.");
      const flags: string[] = [];
      if (c.property.status === "ready" && !a.oc) flags.push("Building completed without an occupation certificate on record: occupation is unauthorised and bank finance is unlikely.");
      if (!a.cc) flags.push("No commencement certificate recorded.");
      if (!a.fireNoc) flags.push("No fire NOC recorded.");
      return { found: true, summary: `IOD ${a.iod ?? "none"}, CC ${a.cc ?? "none"}, OC ${a.oc ?? "pending"}, fire NOC ${a.fireNoc ?? "none"}.`, data: a, flags };
    },
  },
  "mhada-sra": {
    id: "mhada-sra", label: "MHADA / SRA", state: "MH", authority: "MHADA and the Slum Rehabilitation Authority", portal: "https://sra.gov.in", covers: "Redevelopment schemes: MHADA layouts, SRA, DCPR 33(7) and 33(9)",
    read: (c) => {
      const sch = c.record?.redevelopmentScheme;
      if (!sch) return none("Not a redevelopment scheme.");
      const flags = sch === "SRA" ? ["SRA scheme: free-sale component depends on rehabilitation completion; check the Letter of Intent, Annexure II eligibility and rehab building OC."] : sch === "MHADA" ? ["MHADA layout: confirm the MHADA NOC and offer letter, and the surplus area share to MHADA."] : [`DCPR ${sch} cluster or cessed-building redevelopment: confirm tenant consents (51% or more) and the rehab agreement.`];
      return { found: true, summary: `${sch} redevelopment.`, data: { scheme: sch }, flags };
    },
  },
  dcpr: {
    id: "dcpr", label: "DCPR 2034", state: "MH", authority: "MCGM Development Plan", portal: "https://mcgm.gov.in", covers: "Permissible FSI, premium FSI, TDR, fungible area",
    read: (c) => {
      const d = c.record?.dcpr;
      if (!d) return none("No DCPR data on file.");
      const r = dcprCheck(d);
      return { found: true, summary: `Permissible FSI ${r.permissibleFsi}, consumed ${r.fsiConsumed}, headroom ${r.headroom}.`, data: { ...d, ...r }, flags: r.flags };
    },
  },
  "goa-rera": { id: "goa-rera", label: "Goa RERA", state: "GA", authority: "Goa Real Estate Regulatory Authority", portal: "https://rera.goa.gov.in", covers: "Project registration, validity, complaints", read: (c) => reraRead(c, "Goa RERA") },
  "goa-registration": {
    id: "goa-registration", label: "Goa registration", state: "GA", authority: "Inspector General of Registration, Goa", portal: "https://egov.goa.nic.in/regdocsearch", covers: "Registered deeds and stamp duty paid",
    read: (c) => {
      const rows = c.txs.filter((t) => /Goa/.test(t.source));
      if (!rows.length) return none("No registered deeds found for this project.");
      return { found: true, summary: `${rows.length} registered sales in six months.`, data: { transactions: rows.map((t) => ({ date: t.transactedAt, consideration: t.price, areaSqft: t.areaSqft, stampDutyPaid: Math.round((t.price * GOA_RATES.stampStandardPct) / 100) })) }, flags: [] };
    },
  },
  "goa-land-use": {
    id: "goa-land-use", label: "Land use and conversion", state: "GA", authority: "Collector and Town and Country Planning Department, Goa", portal: "https://tcp.goa.gov.in", covers: "Conversion sanad under s.32, zoning certificate",
    read: (c) => {
      const r = c.record;
      if (!r?.conversionStatus) return none("No conversion data on file.");
      const flags = r.conversionStatus === "required" || r.conversionStatus === "applied" ? [`Conversion ${r.conversionStatus === "applied" ? "applied for" : "required"}; typical timeline ${r.conversionDays ?? GOA_RATES.conversionTypicalDays} days.`] : [];
      return { found: true, summary: `Conversion: ${r.conversionStatus.replace("_", " ")}.`, data: { conversionStatus: r.conversionStatus, conversionDays: r.conversionDays }, flags };
    },
  },
  rp2021: {
    id: "rp2021", label: "Regional Plan 2021", state: "GA", authority: "Town and Country Planning Department, Goa", portal: "https://tcp.goa.gov.in/regional-plan", covers: "Settlement, orchard, eco-sensitive and other zones",
    read: (c) => {
      const r = c.record;
      if (!r?.landUse) return none("No RP 2021 zone on file.");
      const z = RP2021_ZONES[r.landUse];
      return { found: true, summary: `${r.rp2021Zone ?? r.landUse}: ${z.buildable ? "buildable" : "not buildable for residential use"}.`, data: { zone: r.rp2021Zone, landUse: r.landUse, ...z }, flags: z.buildable ? [] : [z.note] };
    },
  },
  comunidade: {
    id: "comunidade", label: "Comunidade", state: "GA", authority: "Administrator of Comunidades", portal: "https://www.goa.gov.in", covers: "Aforamento grants, foro, General Body resolutions",
    read: (c) => {
      const r = c.record;
      if (!r?.comunidade) return none("Not Comunidade land.");
      const l = landOf(c, "escritura");
      return { found: true, summary: `Comunidade de ${r.comunidadeName}${l ? `, aforamento ${String(l.parsed.aforamentoNumber ?? "")}` : ""}.`, data: { comunidade: r.comunidadeName, ...(l?.parsed ?? {}) }, flags: l?.warnings ?? ["Aforamento papers not yet on file."] };
    },
  },
  mundkar: {
    id: "mundkar", label: "Mundkar register", state: "GA", authority: "Mamlatdar of the taluka", portal: "https://www.goa.gov.in", covers: "Mundkar declarations and purchase applications",
    read: (c) => {
      const st = c.record?.mundkarStatus;
      if (!st || st === "none") return { found: true, summary: "No mundkar recorded.", data: { status: "none" }, flags: [] };
      return { found: true, summary: `Mundkar ${st}.`, data: { status: st }, flags: st === "settled" ? [] : ["Mundkar's dwelling right survives a sale; settle or exclude the dwelling plot before completion."] };
    },
  },
  "form-i-xiv": {
    id: "form-i-xiv", label: "Form I and XIV", state: "GA", authority: "Directorate of Settlement and Land Records, Goa", portal: "https://dslr.goa.gov.in", covers: "Survey record: occupants, tenants, mundkars, area",
    read: (c) => {
      const l = landOf(c, "form_i_xiv");
      if (!l) return none("No Form I and XIV on file.");
      return { found: true, summary: `Survey ${String(l.parsed.surveyNumber ?? "")}/${String(l.parsed.subDivision ?? "")}, ${l.warnings.length} findings.`, data: l.parsed, flags: l.warnings };
    },
  },
  crz: {
    id: "crz", label: "CRZ", state: "GA", authority: "Goa Coastal Zone Management Authority", portal: "https://gczma.goa.gov.in", covers: "Coastal Regulation Zone classification",
    read: (c) => {
      const z = c.record?.crzZone;
      if (!z) return none("No CRZ classification on file.");
      return { found: true, summary: `${z === "none" ? "Outside CRZ" : z}.`, data: { zone: z, ...CRZ_RULES[z] }, flags: z === "none" || z === "CRZ-II" ? [] : [CRZ_RULES[z].note] };
    },
  },
  escritura: {
    id: "escritura", label: "Escritura", state: "GA", authority: "Archives of Goa / Notary", portal: "https://archives.goa.gov.in", covers: "Portuguese-era notarial deeds and title chain",
    read: (c) => {
      const hist = c.record?.titleHistory ?? [];
      if (!hist.length) return none("No title history on file.");
      const early = hist.find((h) => /escritura|aforamento/i.test(h.document));
      return { found: true, summary: `${hist.length} title events from ${hist[0]!.year}${early ? `; root of title ${early.document} (${early.year})` : ""}.`, data: { titleHistory: hist }, flags: early ? [] : ["No Portuguese-era root of title in the chain: confirm how the first holder acquired the land."] };
    },
  },
};

export const sourcesFor = (state: "MH" | "GA") => Object.values(SOURCES).filter((x) => x.state === state);

export async function lookupSource(db: DB, tenantId: string, source: SourceId, propertyId: string): Promise<SourceResult | null> {
  const def = SOURCES[source];
  const ctx = await loadIndiaContext(db, tenantId, propertyId);
  if (!ctx) return null;
  return { source, label: def.label, authority: def.authority, mode: "mock", asOf: (ctx.record?.updatedAt ?? new Date()).toISOString().slice(0, 10), ...def.read(ctx) };
}

/** Every source for the property's state, in one pass (for the agents and the property file). */
export async function lookupAll(db: DB, tenantId: string, propertyId: string) {
  const ctx = await loadIndiaContext(db, tenantId, propertyId);
  if (!ctx?.record) return { ctx, results: [] as SourceResult[] };
  const asOf = ctx.record.updatedAt.toISOString().slice(0, 10);
  const results = sourcesFor(ctx.record.state).map((def) => ({ source: def.id, label: def.label, authority: def.authority, mode: "mock" as const, asOf, ...def.read(ctx) }));
  return { ctx, results };
}
