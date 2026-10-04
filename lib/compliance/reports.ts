import { JURISDICTIONS, type JurisdictionCode, type ReportType } from "./jurisdictions";

/**
 * Report builders. UAE reports follow the element structure of the goAML
 * schema so they can be imported into the goAML web portal and completed
 * there; India's are FINnet-ready CSV extracts; the UK SAR and Singapore STR
 * are narratives structured the way the NCA SAR Portal and STRO SONAR forms
 * ask for them. Every report is a draft until the MLRO files it and records
 * the filing reference.
 */

export interface ReportParty {
  name: string;
  entityType: "person" | "company";
  nationality?: string | null;
  idNumber?: string | null;
  birthDate?: string | null;
  address?: string | null;
  role: "buyer" | "seller" | "tenant" | "landlord" | "payer";
}

export interface ReportTransaction {
  reference: string;
  date: string;
  amount: number;
  currency: string;
  /** Mode of payment: cash, cheque, bank transfer, virtual asset. */
  mode: "cash" | "cheque" | "bank_transfer" | "virtual_asset" | "mixed";
  cashAmount?: number;
  property: string;
  parties: ReportParty[];
}

export interface ReportInput {
  jurisdiction: JurisdictionCode;
  type: ReportType;
  firm: { name: string; entityId: string | null; mlroName: string; mlroEmail: string | null; address?: string | null };
  submittedAt: Date;
  reference: string;
  reason?: string;
  indicators?: string[];
  action?: string;
  transactions?: ReportTransaction[];
  register?: { name: string; entityType: string; level: string; risk: string; status: string; verifiedAt: string | null; expiresAt: string | null; pep: boolean; sourceOfFunds: string | null; screening: string }[];
  period?: string;
}

const xml = (s: string | number | null | undefined) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
const csvCell = (v: unknown) => {
  const s = String(v ?? "");
  // Formula injection guard for spreadsheets, then RFC 4180 quoting.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

const TRANSMODE: Record<ReportTransaction["mode"], string> = { cash: "C", cheque: "Q", bank_transfer: "B", virtual_asset: "V", mixed: "M" };
const isoDate = (d: Date) => d.toISOString().slice(0, 19);
const splitName = (n: string) => {
  const parts = n.trim().split(/\s+/);
  return { first: parts.slice(0, -1).join(" ") || parts[0]!, last: parts.length > 1 ? parts.at(-1)! : "" };
};

function party(p: ReportParty, tag: string) {
  if (p.entityType === "company") return `      <${tag}><to_entity><name>${xml(p.name)}</name>${p.idNumber ? `<incorporation_number>${xml(p.idNumber)}</incorporation_number>` : ""}${p.nationality ? `<incorporation_country_code>${xml(p.nationality)}</incorporation_country_code>` : ""}</to_entity></${tag}>`;
  const n = splitName(p.name);
  return `      <${tag}><to_person><first_name>${xml(n.first)}</first_name><last_name>${xml(n.last)}</last_name>${p.birthDate ? `<birthdate>${xml(p.birthDate)}T00:00:00</birthdate>` : ""}${p.nationality ? `<nationality1>${xml(p.nationality)}</nationality1>` : ""}${p.idNumber ? `<passport_number>${xml(p.idNumber)}</passport_number>` : ""}</to_person></${tag}>`;
}

/** goAML report (STR or REAR) for the UAE FIU. */
export function goAmlXml(r: ReportInput) {
  const code = r.type === "rear" ? "REAR" : "STR";
  const mlro = splitName(r.firm.mlroName);
  const txs = (r.transactions ?? [])
    .map((t) =>
      [
        "    <transaction>",
        `      <transactionnumber>${xml(t.reference)}</transactionnumber>`,
        `      <transaction_location>${xml(t.property)}</transaction_location>`,
        `      <transaction_description>${xml(`Real estate ${t.parties.some((p) => p.role === "tenant") ? "lease" : "sale"}: ${t.property}`)}</transaction_description>`,
        `      <date_transaction>${xml(t.date)}T00:00:00</date_transaction>`,
        `      <transmode_code>${TRANSMODE[t.mode]}</transmode_code>`,
        `      <amount_local>${t.amount.toFixed(2)}</amount_local>`,
        ...(t.cashAmount ? [`      <comments>${xml(`Cash component ${t.currency} ${t.cashAmount.toFixed(2)}`)}</comments>`] : []),
        ...t.parties.filter((p) => p.role === "buyer" || p.role === "payer" || p.role === "tenant").map((p) => party(p, "t_from")),
        ...t.parties.filter((p) => p.role === "seller" || p.role === "landlord").map((p) => party(p, "t_to")),
        "    </transaction>",
      ].join("\n"),
    )
    .join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<report>",
    `  <rentity_id>${xml(r.firm.entityId ?? "")}</rentity_id>`,
    "  <submission_code>E</submission_code>",
    `  <report_code>${code}</report_code>`,
    `  <entity_reference>${xml(r.reference)}</entity_reference>`,
    `  <submission_date>${isoDate(r.submittedAt)}</submission_date>`,
    "  <currency_code_local>AED</currency_code_local>",
    `  <reporting_person><first_name>${xml(mlro.first)}</first_name><last_name>${xml(mlro.last)}</last_name>${r.firm.mlroEmail ? `<email>${xml(r.firm.mlroEmail)}</email>` : ""}<occupation>Money Laundering Reporting Officer</occupation></reporting_person>`,
    `  <reason>${xml(r.reason ?? (code === "REAR" ? "Real estate purchase involving cash at or above AED 55,000." : ""))}</reason>`,
    `  <action>${xml(r.action ?? "")}</action>`,
    txs,
    r.indicators?.length ? `  <report_indicators>\n${r.indicators.map((i) => `    <indicator>${xml(i)}</indicator>`).join("\n")}\n  </report_indicators>` : "",
    "</report>",
    "",
  ]
    .filter(Boolean)
    .join("\n");
}

/** FIU-IND cash transaction report extract for the month: one row per cash transaction above the threshold. */
export function indiaCtrCsv(r: ReportInput) {
  return toCsv(
    ["Report period", "Transaction reference", "Date", "Amount (INR)", "Cash (INR)", "Mode", "Property", "Party name", "Party role", "Party PAN or ID", "Nationality"],
    (r.transactions ?? []).flatMap((t) => t.parties.map((p) => [r.period ?? "", t.reference, t.date, t.amount.toFixed(2), (t.cashAmount ?? (t.mode === "cash" ? t.amount : 0)).toFixed(2), t.mode, t.property, p.name, p.role, p.idNumber ?? "", p.nationality ?? ""])),
  );
}

export function indiaStrCsv(r: ReportInput) {
  return toCsv(
    ["Report reference", "Prepared", "Grounds of suspicion", "Indicators", "Transaction reference", "Date", "Amount (INR)", "Mode", "Property", "Party name", "Party role", "Party PAN or ID"],
    (r.transactions ?? []).flatMap((t) => t.parties.map((p) => [r.reference, isoDate(r.submittedAt), r.reason ?? "", (r.indicators ?? []).join("; "), t.reference, t.date, t.amount.toFixed(2), t.mode, t.property, p.name, p.role, p.idNumber ?? ""])),
  );
}

/** A SAR (NCA) or STR (STRO) narrative, in the order the online forms ask for it. */
export function narrative(r: ReportInput) {
  const j = JURISDICTIONS[r.jurisdiction];
  const spec = j.reports.find((x) => x.type === r.type);
  const lines = [
    `${spec?.name ?? r.type.toUpperCase()} for ${spec?.receiver ?? j.fiu}`,
    `Reporting firm: ${r.firm.name}${r.firm.address ? `, ${r.firm.address}` : ""}`,
    `Nominated officer: ${r.firm.mlroName}${r.firm.mlroEmail ? ` (${r.firm.mlroEmail})` : ""}`,
    `Internal reference: ${r.reference}`,
    `Prepared: ${isoDate(r.submittedAt).replace("T", " ")} UTC`,
    "",
    "1. Subjects",
    ...(r.transactions ?? []).flatMap((t) => t.parties.map((p) => `   - ${p.name}, ${p.role}${p.nationality ? `, ${p.nationality}` : ""}${p.birthDate ? `, born ${p.birthDate}` : ""}${p.idNumber ? `, ID ${p.idNumber}` : ""}`)),
    "",
    "2. Transaction",
    ...(r.transactions ?? []).map((t) => `   - ${t.reference}: ${t.property}, ${t.currency} ${t.amount.toLocaleString("en-GB", { minimumFractionDigits: 2 })} on ${t.date}, paid by ${t.mode.replace("_", " ")}${t.cashAmount ? ` (cash ${t.currency} ${t.cashAmount.toLocaleString("en-GB", { minimumFractionDigits: 2 })})` : ""}`),
    "",
    "3. Reason for suspicion",
    `   ${r.reason ?? ""}`,
    ...(r.indicators?.length ? ["", "4. Indicators", ...r.indicators.map((i) => `   - ${i}`)] : []),
    "",
    `${r.indicators?.length ? "5" : "4"}. Action taken`,
    `   ${r.action ?? "No further steps taken on the transaction pending the report."}`,
    ...(r.jurisdiction === "GB" ? ["", "If the firm needs to proceed with the transaction, request a Defence Against Money Laundering (DAML) in the SAR and do not proceed until consent is given or the notice period expires."] : []),
    "",
    "Do not disclose this report, or that it is being considered, to the subject (tipping off).",
  ];
  return lines.join("\n") + "\n";
}

export function kycRegisterCsv(r: ReportInput) {
  return toCsv(
    ["Customer", "Type", "Due diligence", "Risk", "Status", "Verified", "Review due", "PEP", "Source of funds", "Latest screening"],
    (r.register ?? []).map((x) => [x.name, x.entityType, x.level, x.risk, x.status, x.verifiedAt ?? "", x.expiresAt ?? "", x.pep ? "Yes" : "No", x.sourceOfFunds ?? "", x.screening]),
  );
}

export function buildReport(r: ReportInput): { format: "goaml_xml" | "csv" | "narrative"; content: string; filename: string; mime: string } {
  const base = `${r.jurisdiction}-${r.type}-${r.reference}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (r.type === "kyc_register") return { format: "csv", content: kycRegisterCsv(r), filename: `${base}.csv`, mime: "text/csv" };
  if (r.jurisdiction === "AE") return { format: "goaml_xml", content: goAmlXml(r), filename: `${base}.xml`, mime: "application/xml" };
  if (r.jurisdiction === "IN") return { format: "csv", content: r.type === "ctr" ? indiaCtrCsv(r) : indiaStrCsv(r), filename: `${base}.csv`, mime: "text/csv" };
  return { format: "narrative", content: narrative(r), filename: `${base}.txt`, mime: "text/plain" };
}
