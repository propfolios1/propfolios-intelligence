import "server-only";
import { z } from "zod";
import { agentCore, defineAgent } from "../agents/define";
import { tally } from "../memory/updater";
import { GOA_LAND_USE_SYSTEM, GOA_LAND_USE_VERSION } from "../prompts/goa-land-use_v1";
import { MAHARERA_COMPLIANCE_SYSTEM, MAHARERA_COMPLIANCE_VERSION } from "../prompts/maharera-compliance_v1";
import { NRI_WORKFLOW_SYSTEM, NRI_WORKFLOW_VERSION } from "../prompts/nri_workflow_v1";
import { READY_RECKONER_SYSTEM, READY_RECKONER_VERSION } from "../prompts/ready-reckoner_v1";
import { TAX_ADVISOR_INDIA_SYSTEM, TAX_ADVISOR_INDIA_VERSION } from "../prompts/tax_advisor_india_v1";

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const crore = (n: number) => `₹${(n / 10_000_000).toFixed(2)} crore`;
const sourceExtract = z.object({ label: z.string(), summary: z.string(), flags: z.array(z.string()), found: z.boolean() });
const sev = z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]);

/* ------------------------------------------------------- 14. MahaRERA compliance */

export const mahareraCompliance = defineAgent({
  name: "maharera-compliance",
  label: "MahaRERA compliance",
  description: "Checks a Mumbai project against MahaRERA, IGR, Ready Reckoner, land records, MCGM approvals and society records.",
  module: "india",
  promptVersion: MAHARERA_COMPLIANCE_VERSION,
  system: MAHARERA_COMPLIANCE_SYSTEM,
  model: "fast",
  instruction: "Assess this Mumbai project's regulatory compliance from the register extracts.",
  toolDescription: "Submit the compliance verdict and checks.",
  input: z.object({
    property: z.object({ id: z.string(), name: z.string(), developer: z.string(), developerId: z.string(), status: z.string(), reraNumber: z.string() }),
    sources: z.array(sourceExtract),
    complaints: z.array(z.object({ category: z.string(), status: z.string(), filedOn: z.string() })),
  }),
  output: agentCore.extend({
    verdict: z.enum(["COMPLIANT", "CONDITIONS", "NON_COMPLIANT"]),
    checks: z.array(z.object({ item: z.string(), status: z.enum(["pass", "warn", "fail"]), evidence: z.string(), reference: z.string() })),
    complaintRisk: z.number().min(0).max(100),
  }),
  outputEntity: (i) => i.property.id,
  memory: {
    types: ["developer_patterns"],
    entity: (i) => i.property.developerId,
    update: ({ input, output, memories }) => {
      const prev = memories.find((m) => m.type === "developer_patterns" && m.scope === "entity")?.memory as { complaintCategories?: Record<string, number>; verdicts?: Record<string, number> } | undefined;
      return [{ type: "developer_patterns", entityId: input.property.developerId, memory: { developer: input.property.developer, complaintCategories: tally(prev?.complaintCategories, input.complaints.map((c) => c.category)), verdicts: tally(prev?.verdicts, [output.verdict]), lastComplaintRisk: output.complaintRisk }, confidence: output.confidence }];
    },
  },
  sample: {
    property: { id: "p1", name: "Hiranandani Castle Rock", developer: "Hiranandani Group", developerId: "d1", status: "under_construction", reraNumber: "P51800024461" },
    sources: [
      { label: "MahaRERA", summary: "P51800024461: extended, valid to 2026-12-31. 4 complaints, 2 open.", flags: ["Registration extended under s.6: possession was delayed beyond the original declared date."], found: true },
      { label: "7/12 extract (Bhulekh)", summary: "Survey 28, 2 findings.", flags: ["Bank charge recorded in other rights: Construction finance charge, ICICI Bank Ltd"], found: true },
      { label: "MCGM building approvals", summary: "IOD CE/2020, CC CE/2021, OC pending, fire NOC FB/HR/2021.", flags: [], found: true },
    ],
    complaints: [
      { category: "Delayed possession", status: "order_passed", filedOn: "2023-08-17" },
      { category: "Refund", status: "order_passed", filedOn: "2024-12-09" },
      { category: "Interest on delay", status: "pending", filedOn: "2025-05-26" },
    ],
  },
  replay: (i) => {
    const checks = i.sources.map((s) => {
      const fatal = s.flags.some((f) => /cannot|refused|unauthorised|lapsed|revoked|Undischarged|Tenure G/i.test(f));
      return { item: s.label, status: !s.found ? (/on file/i.test(s.summary) ? ("warn" as const) : ("pass" as const)) : fatal ? ("fail" as const) : s.flags.length ? ("warn" as const) : ("pass" as const), evidence: s.flags[0] ?? s.summary, reference: s.label };
    });
    const open = i.complaints.filter((c) => !["disposed", "withdrawn"].includes(c.status)).length;
    const orders = i.complaints.filter((c) => c.status === "order_passed").length;
    const delay = i.complaints.filter((c) => /delay|refund/i.test(c.category)).length;
    const complaintRisk = Math.min(100, Math.round(open * 10 + orders * 8 + delay * 4));
    const verdict: "COMPLIANT" | "CONDITIONS" | "NON_COMPLIANT" = checks.some((c) => c.status === "fail") ? "NON_COMPLIANT" : checks.some((c) => c.status === "warn") || complaintRisk >= 50 ? "CONDITIONS" : "COMPLIANT";
    const issues = checks.filter((c) => c.status !== "pass");
    return {
      headline: verdict === "COMPLIANT" ? `${i.property.name} is compliant on every register checked.` : verdict === "CONDITIONS" ? `${i.property.name} is compliant with conditions on ${issues.filter((c) => c.status === "warn").map((c) => c.item).slice(0, 3).join(", ")}${complaintRisk >= 50 ? `, and the promoter's complaint record (risk ${complaintRisk}) needs a delay clause` : ""}.` : `${i.property.name} is not compliant: ${issues.find((c) => c.status === "fail")!.evidence}`,
      points: [
        ...issues.slice(0, 4).map((c) => ({ label: c.item, detail: c.evidence })),
        { label: "Complaint record", detail: `${i.complaints.length} complaints against ${i.property.developer}, ${open} open and ${orders} with orders passed; complaint risk ${complaintRisk} of 100.` },
      ].slice(0, 6),
      confidence: +(0.62 + 0.3 * (i.sources.filter((s) => s.found).length / Math.max(1, i.sources.length))).toFixed(2),
      verdict,
      checks,
      complaintRisk,
    };
  },
});

/* ------------------------------------------------------------ 15. Goa land use */

export const goaLandUse = defineAgent({
  name: "goa-land-use",
  label: "Goa land use",
  description: "RP 2021 zoning, conversion, CRZ, Comunidade, mundkar and title chain for a Goa property, with buyer eligibility.",
  module: "india",
  promptVersion: GOA_LAND_USE_VERSION,
  system: GOA_LAND_USE_SYSTEM,
  model: "primary",
  instruction: "Assess whether this Goa property can be bought and used as intended.",
  toolDescription: "Submit the land use verdict and constraints.",
  input: z.object({
    property: z.object({ id: z.string(), name: z.string(), village: z.string(), purpose: z.enum(["residential", "holiday_home", "land_bank"]) }),
    buyerResidency: z.string(),
    facts: z.object({ landUse: z.string().nullable(), rp2021Zone: z.string().nullable(), crzZone: z.string().nullable(), comunidade: z.boolean(), comunidadeName: z.string().nullable(), mundkarStatus: z.string().nullable(), conversionStatus: z.string().nullable(), conversionDays: z.number().nullable() }),
    titleHistory: z.array(z.object({ year: z.number(), event: z.string(), document: z.string() })),
    recordWarnings: z.array(z.string()),
  }),
  output: agentCore.extend({
    verdict: z.enum(["CLEAR", "CONDITIONAL", "BLOCKED"]),
    buildable: z.boolean(),
    constraints: z.array(z.object({ topic: z.string(), severity: sev, finding: z.string(), action: z.string(), reference: z.string() })),
    conversionTimelineDays: z.number(),
  }),
  outputEntity: (i) => i.property.id,
  memory: { types: ["jurisdiction_patterns"] },
  sample: {
    property: { id: "p2", name: "Acron Siolim Hills", village: "Siolim", purpose: "holiday_home" },
    buyerResidency: "nri",
    facts: { landUse: "orchard", rp2021Zone: "Orchard (part) and Settlement S3", crzZone: "none", comunidade: false, comunidadeName: null, mundkarStatus: "claimed", conversionStatus: "applied", conversionDays: 240 },
    titleHistory: [{ year: 1947, event: "Escritura, Souza family", document: "Escritura de doação" }],
    recordWarnings: ["Mundkar recorded: Anant Naik."],
  },
  replay: (i) => {
    const f = i.facts;
    const c: { topic: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; finding: string; action: string; reference: string }[] = [];
    const nri = /nri|oci/i.test(i.buyerResidency);
    const foreign = /foreign/i.test(i.buyerResidency);
    const nonBuildable = f.landUse === "orchard" || f.landUse === "agricultural" || f.landUse === "conservation";
    if (foreign) c.push({ topic: "Eligibility", severity: "CRITICAL", finding: "A foreign national not resident in India cannot acquire property in Goa.", action: "Do not proceed; consider an Indian resident family member as purchaser only with tax and FEMA advice.", reference: "FEMA (NDI) Rules 2019, Rule 24" });
    if (nri && nonBuildable) c.push({ topic: "Eligibility", severity: "CRITICAL", finding: `NRIs and OCIs cannot acquire ${f.landUse} land.`, action: "Limit the purchase to built property on settlement-zone land, or wait for conversion and sub-division.", reference: "FEMA (NDI) Rules 2019" });
    if (nonBuildable) c.push({ topic: "Zoning", severity: f.rp2021Zone && /settlement/i.test(f.rp2021Zone) ? "HIGH" : "CRITICAL", finding: `RP 2021 zone ${f.rp2021Zone ?? f.landUse}: residential construction is not permitted on the ${f.landUse} portion.`, action: "Confirm with a TCP zoning certificate which portion is settlement; value only the buildable portion.", reference: "Regional Plan for Goa 2021" });
    if (f.crzZone === "CRZ-I" || f.crzZone === "CRZ-IV") c.push({ topic: "Coastal", severity: "CRITICAL", finding: `${f.crzZone}: no new construction.`, action: "Do not proceed for development.", reference: "CRZ Notification 2019" });
    else if (f.crzZone === "CRZ-III") c.push({ topic: "Coastal", severity: "HIGH", finding: "CRZ-III: no-development zone up to 200 m from the high tide line.", action: "Obtain the GCZMA plan showing the HTL setback and confirm every unit lies landward of it.", reference: "CRZ Notification 2019, para 5.3" });
    if (f.conversionStatus === "applied" || f.conversionStatus === "required") c.push({ topic: "Conversion", severity: "HIGH", finding: `Conversion under s.32 ${f.conversionStatus === "applied" ? `applied for ${f.conversionDays ?? 0} days ago` : "required"}.`, action: "Make the sanad a condition precedent; hold payments above 10% in escrow until it issues.", reference: "Goa Land Revenue Code 1968, s.32" });
    if (f.mundkarStatus === "claimed" || f.mundkarStatus === "declared") c.push({ topic: "Mundkar", severity: "HIGH", finding: `Mundkar ${f.mundkarStatus}; the dwelling right survives a sale.`, action: "Exclude the dwelling plot or settle the claim before completion, with a retention.", reference: "Mundkars Act 1975, ss.15 and 18" });
    if (f.comunidade) c.push({ topic: "Comunidade", severity: i.recordWarnings.some((w) => /non-alienation|No approval|No General Body/i.test(w)) ? "HIGH" : "LOW", finding: `Land held from the Comunidade de ${f.comunidadeName ?? "the village"} on aforamento.`, action: "Obtain the Comunidade's consent to transfer and confirm foro is paid to date.", reference: "Code of Comunidades 1961" });
    if (!i.titleHistory.some((h) => /escritura|aforamento/i.test(h.document))) c.push({ topic: "Title", severity: "MEDIUM", finding: "No Portuguese-era root of title in the chain on file.", action: "Search the Archives of Goa for the Escritura or the 1971 survey entry.", reference: "Market practice" });
    const remaining = f.conversionStatus === "applied" ? Math.max(30, 180 - Math.min(150, f.conversionDays ?? 0) + 30) : f.conversionStatus === "required" ? 180 : 0;
    const blocked = c.some((x) => x.severity === "CRITICAL" && (x.topic === "Coastal" || x.topic === "Eligibility" && (foreign || !/settlement/i.test(f.rp2021Zone ?? ""))));
    const verdict: "CLEAR" | "CONDITIONAL" | "BLOCKED" = blocked ? "BLOCKED" : c.some((x) => x.severity === "CRITICAL" || x.severity === "HIGH") ? "CONDITIONAL" : "CLEAR";
    return {
      headline: verdict === "CLEAR" ? `${i.property.name} is clear for ${i.property.purpose.replace("_", " ")} use on settlement land with a sound title chain.` : verdict === "CONDITIONAL" ? `Conditional: ${c.filter((x) => x.severity !== "LOW").map((x) => x.topic.toLowerCase()).slice(0, 3).join(", ")} must be resolved before ${i.property.name} completes.` : `Blocked: ${c.find((x) => x.severity === "CRITICAL")!.finding}`,
      points: (c.length ? c.slice(0, 5).map((x) => ({ label: `${x.topic} (${x.severity})`, detail: `${x.finding} ${x.action}` })) : [{ label: "Land", detail: `RP 2021 ${f.rp2021Zone ?? "settlement"}; outside the restrictive CRZ categories; no mundkar or tenant recorded.` }]),
      confidence: i.recordWarnings.length || i.titleHistory.length ? 0.78 : 0.6,
      verdict,
      buildable: !blocked && (!nonBuildable || /settlement/i.test(f.rp2021Zone ?? "")),
      constraints: c,
      conversionTimelineDays: remaining,
    };
  },
});

/* -------------------------------------------------------- 16. India tax advisor */

const taxLine = z.object({ label: z.string(), payer: z.enum(["buyer", "seller"]), amount: z.number(), reference: z.string() });

export const indiaTaxAdvisor = defineAgent({
  name: "india-tax-advisor",
  label: "India tax advisor",
  description: "Explains stamp duty, registration, GST, TDS and capital gains from the rules engine, with lawful structuring and filings.",
  module: "india",
  promptVersion: TAX_ADVISOR_INDIA_VERSION,
  system: TAX_ADVISOR_INDIA_SYSTEM,
  model: "primary",
  instruction: "Explain the computed taxes, propose lawful structuring and list the filings.",
  toolDescription: "Submit the tax explanation, structuring options and filings.",
  input: z.object({
    jurisdiction: z.enum(["mumbai", "maharashtra", "goa"]),
    value: z.number(),
    buyer: z.object({ gender: z.string(), residency: z.string() }),
    seller: z.object({ residency: z.string(), holdingMonths: z.number() }).nullable(),
    breakdown: z.object({ lines: z.array(taxLine), buyerTotal: z.number(), sellerTotal: z.number(), buyerCostPct: z.number(), notes: z.array(z.string()) }),
    clientId: z.string().nullable(),
  }),
  output: agentCore.extend({
    buyerCostPct: z.number(),
    structuring: z.array(z.object({ option: z.string(), savingInr: z.number(), caveat: z.string() })),
    filings: z.array(z.object({ form: z.string(), owner: z.string(), due: z.string(), reference: z.string() })),
  }),
  memory: {
    types: ["client_preferences"],
    entity: (i) => i.clientId,
    update: ({ input }) => (input.clientId ? [{ type: "client_preferences", entityId: input.clientId, memory: { buyerGender: input.buyer.gender, residency: input.buyer.residency, lastJurisdiction: input.jurisdiction } }] : []),
  },
  sample: {
    jurisdiction: "mumbai",
    value: 52_000_000,
    buyer: { gender: "male", residency: "nri" },
    seller: { residency: "resident", holdingMonths: 60 },
    breakdown: { lines: [{ label: "Stamp duty (5% + 1% metro cess)", payer: "buyer", amount: 3_120_000, reference: "Maharashtra Stamp Act, Art. 25" }, { label: "Registration fee (1%, capped)", payer: "buyer", amount: 30_000, reference: "Registration fee table" }, { label: "TDS under s.194-IA (1%)", payer: "seller", amount: 520_000, reference: "Income-tax Act 1961, s.194-IA" }], buyerTotal: 3_150_000, sellerTotal: 520_000, buyerCostPct: 6.06, notes: [] },
    clientId: null,
  },
  replay: (i) => {
    const stamp = i.breakdown.lines.find((l) => /stamp duty/i.test(l.label));
    const structuring: { option: string; savingInr: number; caveat: string }[] = [];
    if (stamp && i.buyer.gender === "male" && i.buyer.residency !== "company") {
      const pts = i.jurisdiction === "goa" ? 1 : 1;
      structuring.push({ option: "Purchase in the sole name of a woman family member", savingInr: Math.round((i.value * pts) / 100), caveat: i.jurisdiction === "goa" ? "Goa's 2.5% rate applies to a woman purchaser; confirm the funding trail to avoid clubbing of income." : "The concession is recovered if the property is sold to a man within 15 years." });
    }
    if (i.seller && i.seller.holdingMonths <= 24) structuring.push({ option: `Defer the sale by ${25 - i.seller.holdingMonths} months to qualify as long-term`, savingInr: Math.round(i.breakdown.sellerTotal * 0.55), caveat: "Long-term gains are taxed at 12.5% instead of slab rates; market risk over the deferral." });
    if (i.seller) structuring.push({ option: "Reinvest the gain in a residential property (s.54) or capital gains bonds (s.54EC, up to ₹50 lakh)", savingInr: Math.round(i.breakdown.sellerTotal * 0.8), caveat: "Reinvestment within two years (s.54) or six months (s.54EC); bonds are locked in for five years." });
    if (i.seller?.residency === "nri") structuring.push({ option: "Lower-deduction certificate under s.197 before the agreement", savingInr: Math.round(i.breakdown.sellerTotal * 0.6), caveat: "Takes four to six weeks from the assessing officer." });
    const filings = [
      ...(i.breakdown.lines.some((l) => /194-IA/.test(l.reference)) ? [{ form: "Form 26QB and Form 16B", owner: "Buyer", due: "Within 30 days of the end of the month of each payment", reference: "Income-tax Act 1961, s.194-IA" }] : []),
      ...(i.breakdown.lines.some((l) => /s\.195/.test(l.reference)) ? [{ form: "TAN application, Form 27Q and Form 16A", owner: "Buyer", due: "TAN before the first payment; Form 27Q quarterly", reference: "Income-tax Act 1961, s.195" }] : []),
      ...(/nri|oci/.test(i.buyer.residency) || i.seller?.residency === "nri" ? [{ form: "Forms 15CA and 15CB", owner: "Chartered accountant", due: "Before each remittance abroad", reference: "Income-tax Rules 1962, r.37BB" }] : []),
      { form: "Income-tax return in India", owner: i.seller ? "Seller" : "Buyer (if rental income)", due: "31 July after the financial year", reference: "Income-tax Act 1961, s.139" },
    ];
    return {
      headline: `Buyer costs are ${i.breakdown.buyerCostPct.toFixed(2)}% of the price (${inr(i.breakdown.buyerTotal)})${structuring[0] ? `; ${structuring[0].option.toLowerCase()} saves up to ${inr(structuring[0].savingInr)}` : ""}.`,
      points: i.breakdown.lines.slice(0, 5).map((l) => ({ label: l.label, detail: `${inr(l.amount)} payable by the ${l.payer} (${l.reference}).` })).concat(i.breakdown.notes.length ? [{ label: "Note", detail: i.breakdown.notes[0]! }] : []).slice(0, 6),
      confidence: 0.86,
      buyerCostPct: i.breakdown.buyerCostPct,
      structuring,
      filings,
    };
  },
});

/* ------------------------------------------------------------- 17. NRI workflow */

export const nriWorkflow = defineAgent({
  name: "nri-workflow",
  label: "NRI workflow",
  description: "Step-by-step purchase or sale plan for an NRI client from the UAE: accounts, power of attorney, payments, registration, TDS and repatriation.",
  module: "india",
  promptVersion: NRI_WORKFLOW_VERSION,
  system: NRI_WORKFLOW_SYSTEM,
  model: "fast",
  instruction: "Produce the NRI workflow for this client and transaction.",
  toolDescription: "Submit the ordered workflow, repatriation position and power of attorney requirement.",
  input: z.object({
    client: z.object({ id: z.string().nullable(), name: z.string(), residency: z.string(), nationality: z.string(), canTravel: z.boolean() }),
    side: z.enum(["buy", "sell"]),
    jurisdiction: z.enum(["mumbai", "maharashtra", "goa"]),
    propertyName: z.string(),
    valueInr: z.number(),
    landUse: z.string().nullable(),
    fundedFrom: z.enum(["nre", "nro", "fcnr", "inward_remittance", "mixed"]),
  }),
  output: agentCore.extend({
    steps: z.array(z.object({ step: z.string(), owner: z.string(), documents: z.array(z.string()), dayOffset: z.number(), reference: z.string() })),
    repatriation: z.object({ eligible: z.boolean(), annualLimitUsd: z.number(), forms: z.array(z.string()), note: z.string() }),
    poaRequired: z.boolean(),
  }),
  memory: {
    types: ["client_preferences"],
    entity: (i) => i.client.id,
    update: ({ input }) => (input.client.id ? [{ type: "client_preferences", entityId: input.client.id, memory: { canTravel: input.client.canTravel, fundedFrom: input.fundedFrom } }] : []),
  },
  sample: { client: { id: null, name: "Rajesh Iyer", residency: "NRI (UAE)", nationality: "Indian", canTravel: false }, side: "buy", jurisdiction: "mumbai", propertyName: "Hiranandani Gardens Glen Gate", valueInr: 48_000_000, landUse: null, fundedFrom: "nre" },
  replay: (i) => {
    const foreign = !/indian|oci/i.test(i.client.nationality) && !/nri|oci/i.test(i.client.residency);
    if (foreign) return { headline: `${i.client.name} is a foreign national not resident in India and cannot acquire property in India.`, points: [{ label: "Eligibility", detail: "FEMA (Non-debt Instruments) Rules 2019, Rule 24 prohibits the acquisition." }], confidence: 0.9, steps: [{ step: "Stop: the client is not eligible to acquire immovable property in India", owner: "Firm", documents: [], dayOffset: 0, reference: "FEMA (NDI) Rules 2019, Rule 24" }], repatriation: { eligible: false, annualLimitUsd: 0, forms: [], note: "Not applicable." }, poaRequired: false };
    const poa = !i.client.canTravel;
    const goa = i.jurisdiction === "goa";
    const agri = /agricultur|orchard|plantation/i.test(i.landUse ?? "");
    const buy = [
      ...(agri ? [{ step: `Stop: ${i.landUse} land cannot be acquired by an NRI or OCI; restrict to settlement-zone built property`, owner: "Firm", documents: [], dayOffset: 0, reference: "FEMA (NDI) Rules 2019" }] : []),
      { step: "Confirm NRE and NRO accounts, PAN and KYC with the Indian bank", owner: "Client", documents: ["Passport", "Emirates ID", "UAE residence visa", "PAN card", "Overseas address proof"], dayOffset: 0, reference: "FEMA (NDI) Rules 2019; RBI Master Direction on KYC" },
      { step: goa ? "Title search to the Escritura root, Form I and XIV, RP 2021 zone and CRZ certificates" : "30-year title search, public notice, MahaRERA and society NOC checks", owner: "Advocate", documents: goa ? ["Form I and XIV", "Escritura", "TCP zone certificate"] : ["Property card or 7/12", "Index II", "Society NOC"], dayOffset: 3, reference: goa ? "Goa Land Revenue Code 1968" : "RERA 2016; MCS Act 1960" },
      ...(poa ? [{ step: "Execute a specific power of attorney in the UAE: notarise, attest at the Indian Consulate in Dubai, adjudicate in India within three months", owner: "Client", documents: ["Draft POA", "Passport copies", "Attorney's ID"], dayOffset: 7, reference: "Registration Act 1908, s.33; Indian Stamp Act, s.18" }] : []),
      { step: `Pay the consideration from the ${i.fundedFrom.toUpperCase()} account by banking channels only`, owner: "Client", documents: ["Payment schedule", "Bank transfer confirmations"], dayOffset: 14, reference: "FEMA (NDI) Rules 2019, Schedule III" },
      { step: "Deduct and deposit TDS on the purchase price and file the TDS return", owner: "Chartered accountant", documents: ["Seller PAN", "Form 26QB or Form 27Q"], dayOffset: 21, reference: "Income-tax Act 1961, s.194-IA / s.195" },
      { step: `Pay stamp duty and register the ${goa ? "sale deed" : "agreement"} at the Sub-Registrar with biometrics`, owner: poa ? "Attorney" : "Client", documents: ["Stamp duty challan", "Agreement", "Photographs", "ID"], dayOffset: 30, reference: "Registration Act 1908, s.17" },
      { step: goa ? "Mutation in Form I and XIV with the Mamlatdar" : "Society share transfer and property tax mutation with MCGM", owner: "Firm", documents: ["Registered deed", "Index II"], dayOffset: 45, reference: goa ? "Goa Land Revenue Code, s.96" : "MCS Act 1960" },
    ];
    const sell = [
      { step: "Apply for a lower-deduction certificate under s.197", owner: "Chartered accountant", documents: ["Purchase deed", "Cost of improvement", "Computation of gain"], dayOffset: 0, reference: "Income-tax Act 1961, s.197" },
      ...(poa ? [{ step: "Execute and attest a specific power of attorney for the sale", owner: "Client", documents: ["Draft POA", "Passport copies"], dayOffset: 5, reference: "Registration Act 1908, s.33" }] : []),
      { step: "Agreement with the buyer; the buyer obtains a TAN and deducts TDS under s.195", owner: "Buyer", documents: ["Seller PAN", "s.197 certificate"], dayOffset: 30, reference: "Income-tax Act 1961, s.195" },
      { step: "Receive the proceeds in the NRO account; file Forms 15CA and 15CB", owner: "Chartered accountant", documents: ["Sale deed", "Form 16A", "CA certificate"], dayOffset: 45, reference: "Income-tax Rules 1962, r.37BB" },
      { step: "Remit to the UAE within the USD 1 million annual limit", owner: "Bank", documents: ["Form A2", "Forms 15CA and 15CB"], dayOffset: 50, reference: "FEMA: Remittance of Assets Regulations 2016" },
    ];
    const steps = i.side === "buy" ? buy : sell;
    return {
      headline: agri ? `${i.client.name} cannot buy ${i.landUse} land; the workflow is limited to settlement-zone built property.` : `${i.side === "buy" ? "Purchase" : "Sale"} of ${i.propertyName} can complete in about ${steps[steps.length - 1]!.dayOffset} days${poa ? " through a specific power of attorney" : ""}, funded from the ${i.fundedFrom.toUpperCase()} account.`,
      points: steps.slice(0, 5).map((s) => ({ label: `Day ${s.dayOffset}`, detail: `${s.step} (${s.owner}).` })),
      confidence: 0.84,
      steps,
      repatriation: { eligible: i.fundedFrom !== "nro" || i.side === "sell", annualLimitUsd: 1_000_000, forms: ["Form 15CA", "Form 15CB", "Form A2"], note: i.fundedFrom === "nre" || i.fundedFrom === "fcnr" ? "Purchase funded from NRE or FCNR: sale proceeds up to the original foreign currency amount are repatriable for up to two residential properties." : "Sale proceeds are credited to NRO; up to USD 1 million per financial year may be remitted with Forms 15CA and 15CB." },
      poaRequired: poa,
    };
  },
});

/* ---------------------------------------------------------- 18. Ready Reckoner */

export const readyReckoner = defineAgent({
  name: "ready-reckoner",
  label: "Ready Reckoner",
  description: "Compares the agreement value with the Ready Reckoner value and registered comparables; stamp duty base and s.50C exposure.",
  module: "india",
  promptVersion: READY_RECKONER_VERSION,
  system: READY_RECKONER_SYSTEM,
  model: "fast",
  instruction: "Assess the agreement value against the Ready Reckoner and comparables.",
  toolDescription: "Submit the Ready Reckoner assessment.",
  input: z.object({ propertyId: z.string(), propertyName: z.string(), zone: z.string(), year: z.number(), ratePerSqm: z.number(), carpetAreaSqm: z.number(), agreementValue: z.number(), governmentValue: z.number(), comparablesPerSqm: z.array(z.number()) }),
  output: agentCore.extend({ dutyBase: z.number(), gapPct: z.number(), s50cRisk: z.boolean(), recommendation: z.enum(["PROCEED", "RENEGOTIATE", "DOCUMENT_JUSTIFICATION"]) }),
  outputEntity: (i) => i.propertyId,
  memory: { types: ["jurisdiction_patterns"] },
  sample: { propertyId: "p3", propertyName: "Oberoi Esquire", zone: "Goregaon East 41/192", year: 2026, ratePerSqm: 231_000, carpetAreaSqm: 112, agreementValue: 38_000_000, governmentValue: 31_046_400, comparablesPerSqm: [380_000, 392_000, 401_000, 371_000] },
  replay: (i) => {
    const gapPct = +(((i.agreementValue - i.governmentValue) / i.governmentValue) * 100).toFixed(1);
    const dutyBase = Math.max(i.agreementValue, i.governmentValue);
    const s50cRisk = i.agreementValue < i.governmentValue * 0.9;
    const sorted = [...i.comparablesPerSqm].sort((a, b) => a - b);
    const med = sorted.length ? sorted[Math.floor(sorted.length / 2)]! : null;
    const perSqm = i.agreementValue / i.carpetAreaSqm;
    const vsComps = med ? ((perSqm - med) / med) * 100 : null;
    const recommendation: "PROCEED" | "RENEGOTIATE" | "DOCUMENT_JUSTIFICATION" = s50cRisk ? "DOCUMENT_JUSTIFICATION" : vsComps !== null && vsComps > 8 ? "RENEGOTIATE" : "PROCEED";
    return {
      headline: s50cRisk ? `The agreement is ${Math.abs(gapPct)}% below the Ready Reckoner value; duty is charged on ${crore(dutyBase)} and both parties face deemed-income tax on the shortfall.` : `The agreement is ${gapPct >= 0 ? `${gapPct}% above` : `${Math.abs(gapPct)}% below, within the 10% tolerance of,`} the Ready Reckoner value, so duty is charged on ${crore(dutyBase)}.`,
      points: [
        { label: "Ready Reckoner", detail: `${i.zone} (${i.year}): ${inr(i.ratePerSqm)} per sq m; government value ${crore(i.governmentValue)} on ${i.carpetAreaSqm} sq m.` },
        { label: "Agreement", detail: `${crore(i.agreementValue)}, ${inr(perSqm)} per sq m.` },
        ...(med ? [{ label: "Registered comparables", detail: `Median ${inr(med)} per sq m across ${sorted.length} Index II entries; the agreement is ${vsComps! >= 0 ? `${vsComps!.toFixed(1)}% above` : `${Math.abs(vsComps!).toFixed(1)}% below`}.` }] : []),
        { label: "Recommendation", detail: recommendation === "PROCEED" ? "Price is supported by registered evidence; proceed." : recommendation === "RENEGOTIATE" ? "Price is above registered evidence by more than 8%; renegotiate." : "Record the reasons for the discount (condition, distress, encumbrance) and a registered valuer's report to defend the s.50C position." },
      ],
      confidence: med ? 0.82 : 0.64,
      dutyBase,
      gapPct,
      s50cRisk,
      recommendation,
    };
  },
});

export const INDIA_AGENTS = [mahareraCompliance, goaLandUse, indiaTaxAdvisor, nriWorkflow, readyReckoner] as const;
