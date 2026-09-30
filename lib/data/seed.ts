import type {
  Analyst,
  AuditEvent,
  Client,
  ClientRecommendation,
  Developer,
  DocumentItem,
  Holding,
  Mandate,
  MandateStatus,
  MarketMonth,
  Memo,
  PortfolioAlert,
  Property,
  SupplyPoint,
  User,
} from "./types";
import { MANDATE_STAGES } from "./types";

/** Deterministic PRNG so seed data is identical on server and client. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260930);
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rand() * arr.length)]!;
const between = (min: number, max: number) => min + rand() * (max - min);
const round = (n: number, step: number) => Math.round(n / step) * step;

/** Anchor all seed timestamps to the top of the current hour. */
export const SEED_NOW = (() => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  return d.getTime();
})();
const hoursAgo = (h: number) => new Date(SEED_NOW - h * 3_600_000).toISOString();
const daysFromNow = (d: number) => new Date(SEED_NOW + d * 86_400_000).toISOString();

export const analysts: Analyst[] = [
  { id: "an_01", name: "Aisha Rahman", role: "Senior Analyst" },
  { id: "an_02", name: "Rohan Mehta", role: "Analyst" },
  { id: "an_03", name: "Claire Dubois", role: "Associate Director" },
  { id: "an_04", name: "Omar Haddad", role: "Analyst" },
];

export const clients: Client[] = [
  { id: "cl_01", name: "Al Noor Family Office", type: "Family Office", domicile: "Abu Dhabi", aumUsd: 1_400_000_000, relationshipLead: "Claire Dubois" },
  { id: "cl_02", name: "Kapoor Holdings", type: "Family Office", domicile: "Mumbai", aumUsd: 620_000_000, relationshipLead: "Rohan Mehta" },
  { id: "cl_03", name: "Harrington Trust", type: "Private Bank", domicile: "London", aumUsd: 2_100_000_000, relationshipLead: "Claire Dubois" },
  { id: "cl_04", name: "Sheikh R. Al Mansoori", type: "HNWI", domicile: "Dubai", aumUsd: 310_000_000, relationshipLead: "Aisha Rahman" },
  { id: "cl_05", name: "Veda Capital Partners", type: "Family Office", domicile: "Singapore", aumUsd: 870_000_000, relationshipLead: "Rohan Mehta" },
  { id: "cl_06", name: "M. Lindqvist", type: "HNWI", domicile: "Stockholm", aumUsd: 145_000_000, relationshipLead: "Omar Haddad" },
  { id: "cl_07", name: "Qasr Endowment", type: "Endowment", domicile: "Doha", aumUsd: 3_400_000_000, relationshipLead: "Aisha Rahman" },
  { id: "cl_08", name: "Desai & Sons", type: "Family Office", domicile: "Bengaluru", aumUsd: 280_000_000, relationshipLead: "Omar Haddad" },
];

export const developers: Developer[] = [
  { id: "dv_01", name: "Emaar Properties", market: "UAE", hq: "Dubai", riskScore: 14, deliveryPct: 96, litigationCount: 2, projectsDelivered: 112, escrowCompliant: true, updatedAt: hoursAgo(20), brandColor: "#0a1f44" },
  { id: "dv_02", name: "Aldar Properties", market: "UAE", hq: "Abu Dhabi", riskScore: 12, deliveryPct: 97, litigationCount: 1, projectsDelivered: 86, escrowCompliant: true, updatedAt: hoursAgo(30), brandColor: "#22396a" },
  { id: "dv_03", name: "Sobha Realty", market: "UAE", hq: "Dubai", riskScore: 22, deliveryPct: 91, litigationCount: 3, projectsDelivered: 41, escrowCompliant: true, updatedAt: hoursAgo(44), brandColor: "#3a5080" },
  { id: "dv_04", name: "DAMAC Properties", market: "UAE", hq: "Dubai", riskScore: 41, deliveryPct: 78, litigationCount: 11, projectsDelivered: 64, escrowCompliant: true, updatedAt: hoursAgo(12), brandColor: "#152c58" },
  { id: "dv_05", name: "Nakheel", market: "UAE", hq: "Dubai", riskScore: 33, deliveryPct: 82, litigationCount: 7, projectsDelivered: 58, escrowCompliant: true, updatedAt: hoursAgo(70), brandColor: "#6479a0" },
  { id: "dv_06", name: "Ellington Properties", market: "UAE", hq: "Dubai", riskScore: 26, deliveryPct: 89, litigationCount: 1, projectsDelivered: 19, escrowCompliant: true, updatedAt: hoursAgo(90), brandColor: "#0f2350" },
  { id: "dv_07", name: "Binghatti", market: "UAE", hq: "Dubai", riskScore: 48, deliveryPct: 74, litigationCount: 6, projectsDelivered: 27, escrowCompliant: true, updatedAt: hoursAgo(8), brandColor: "#3f3c38" },
  { id: "dv_08", name: "Horizon Crest Developments", market: "UAE", hq: "Ras Al Khaimah", riskScore: 67, deliveryPct: 58, litigationCount: 14, projectsDelivered: 6, escrowCompliant: false, updatedAt: hoursAgo(5), brandColor: "#5d5953" },
  { id: "dv_09", name: "Godrej Properties", market: "India", hq: "Mumbai", riskScore: 19, deliveryPct: 92, litigationCount: 4, projectsDelivered: 98, escrowCompliant: true, updatedAt: hoursAgo(26), brandColor: "#22396a" },
  { id: "dv_10", name: "DLF", market: "India", hq: "Gurugram", riskScore: 31, deliveryPct: 84, litigationCount: 18, projectsDelivered: 150, escrowCompliant: true, updatedAt: hoursAgo(50), brandColor: "#0a1f44" },
  { id: "dv_11", name: "Prestige Group", market: "India", hq: "Bengaluru", riskScore: 24, deliveryPct: 88, litigationCount: 9, projectsDelivered: 280, escrowCompliant: true, updatedAt: hoursAgo(60), brandColor: "#152c58" },
  { id: "dv_12", name: "Lodha Group", market: "India", hq: "Mumbai", riskScore: 36, deliveryPct: 81, litigationCount: 13, projectsDelivered: 110, escrowCompliant: true, updatedAt: hoursAgo(36), brandColor: "#3a5080" },
  { id: "dv_13", name: "Meridian Urban Infra", market: "India", hq: "Pune", riskScore: 72, deliveryPct: 52, litigationCount: 21, projectsDelivered: 9, escrowCompliant: false, updatedAt: hoursAgo(3), brandColor: "#7c776f" },
  { id: "dv_14", name: "Meraas", market: "UAE", hq: "Dubai", riskScore: 18, deliveryPct: 93, litigationCount: 2, projectsDelivered: 37, escrowCompliant: true, updatedAt: hoursAgo(100), brandColor: "#0f2350" },
];

const uaeSites: [string, string, number, number][] = [
  ["Dubai", "Downtown Dubai", 25.1972, 55.2744],
  ["Dubai", "Dubai Marina", 25.0805, 55.1403],
  ["Dubai", "Palm Jumeirah", 25.1124, 55.139],
  ["Dubai", "Dubai Hills Estate", 25.1115, 55.2466],
  ["Dubai", "Business Bay", 25.1865, 55.2637],
  ["Dubai", "Jumeirah Village Circle", 25.0587, 55.2064],
  ["Dubai", "Dubai Creek Harbour", 25.2008, 55.3456],
  ["Dubai", "Mohammed Bin Rashid City", 25.1674, 55.3027],
  ["Abu Dhabi", "Saadiyat Island", 24.5447, 54.4336],
  ["Abu Dhabi", "Yas Island", 24.4958, 54.6066],
  ["Abu Dhabi", "Al Reem Island", 24.4989, 54.4058],
  ["Ras Al Khaimah", "Al Marjan Island", 25.6694, 55.7472],
  ["Sharjah", "Aljada", 25.3, 55.4667],
];
const indiaSites: [string, string, number, number][] = [
  ["Maharashtra", "Worli, Mumbai", 19.0176, 72.8165],
  ["Maharashtra", "Bandra Kurla Complex", 19.0662, 72.8656],
  ["Haryana", "Golf Course Road, Gurugram", 28.4595, 77.0966],
  ["Karnataka", "Whitefield, Bengaluru", 12.9698, 77.75],
  ["Karnataka", "Hebbal, Bengaluru", 13.0358, 77.597],
  ["Maharashtra", "Hinjewadi, Pune", 18.5913, 73.7389],
  ["Goa", "Assagao, North Goa", 15.5937, 73.7596],
];

const nameA = ["The", "One", "Aurum", "Serene", "Azure", "Cedar", "Solace", "Meridian", "Crescent", "Lumen", "Harbour", "Opal", "Vantage", "Elysian", "Tidal"];
const nameB = ["Residences", "Tower", "Heights", "Collection", "Park", "Point", "Gardens", "Quarter", "Villas", "Bay", "House", "Terraces"];
const uaeDevs = developers.filter((d) => d.market === "UAE").map((d) => d.id);
const indDevs = developers.filter((d) => d.market === "India").map((d) => d.id);
const classes = ["Residential", "Residential", "Residential", "Branded Residence", "Office", "Hospitality", "Retail", "Logistics"] as const;

export const properties: Property[] = Array.from({ length: 32 }, (_, i) => {
  const isIndia = i % 4 === 3;
  const site = isIndia ? pick(indiaSites) : pick(uaeSites);
  const assetClass = pick(classes);
  const currency = isIndia ? "INR" : "AED";
  const base = isIndia ? between(25_000_000, 180_000_000) : between(1_200_000, 18_000_000);
  const status = pick(["Off-plan", "Off-plan", "Under construction", "Ready"] as const);
  const n1 = nameA[(i * 7) % nameA.length]!;
  const n2 = nameB[(i * 5) % nameB.length]!;
  const name = n1 === "The" ? `The ${site[1].split(",")[0]} ${n2}` : `${n1} ${n2}`;
  return {
    id: `pr_${String(i + 1).padStart(2, "0")}`,
    name,
    developerId: pick(isIndia ? indDevs : uaeDevs),
    market: isIndia ? "India" : "UAE",
    region: site[0],
    community: site[1],
    assetClass,
    priceMin: round(base, isIndia ? 500_000 : 50_000),
    priceMax: round(base * between(1.6, 3.2), isIndia ? 500_000 : 50_000),
    currency,
    status,
    handover: status === "Ready" ? "Completed" : `Q${1 + Math.floor(rand() * 4)} ${2027 + Math.floor(rand() * 3)}`,
    grossYield: +between(4.8, 8.9).toFixed(1),
    lat: site[2] + between(-0.02, 0.02),
    lng: site[3] + between(-0.02, 0.02),
    units: Math.round(between(40, 900)),
    hue: Math.round(between(200, 230)),
  } satisfies Property;
});

const objectives = [
  "Capital preservation with 6–8% net yield",
  "Opportunistic off-plan entry, 5-year exit",
  "Diversify GCC exposure into prime India residential",
  "Golden Visa-qualifying residential allocation",
  "Core-plus income with inflation-linked leases",
  "Branded residence for family use plus rental",
];

// Distribution across pipeline stages, weighted toward early stages.
const stageWeights: MandateStatus[] = [
  "intake", "intake", "intake", "research", "research", "research", "research",
  "underwriting", "underwriting", "underwriting", "dd", "dd", "debate", "debate",
  "memo", "memo", "memo", "review", "review", "delivered", "delivered", "delivered", "delivered", "delivered",
];

export const mandates: Mandate[] = stageWeights.map((status, i) => {
  const createdH = 24 * (2 + ((i * 3.7) % 40));
  return {
    id: `MND-${2041 + i}`,
    clientId: clients[i % clients.length]!.id,
    propertyId: properties[(i * 3) % properties.length]!.id,
    status,
    analystId: analysts[i % analysts.length]!.id,
    createdAt: hoursAgo(createdH),
    updatedAt: hoursAgo(Math.max(1, Math.round(createdH / (4 + (i % 5))))),
    deadline: daysFromNow(status === "delivered" ? -((i % 9) + 1) : (i % 13) + 2),
    ticketSize: round(between(2_000_000, 40_000_000), 250_000),
    objective: objectives[i % objectives.length]!,
    horizonYears: 3 + (i % 5),
    priority: i % 5 === 0 ? "Priority" : "Standard",
  };
});

const agentActions: [string, string][] = [
  ["research", "compiled research dossier"],
  ["underwriting", "ran Monte Carlo underwriting (10,000 paths)"],
  ["due-diligence", "flagged findings in developer escrow review"],
  ["bull", "argued bull case"],
  ["bear", "argued bear case"],
  ["judge", "issued debate decision"],
  ["memo-writer", "drafted investment memo"],
  ["fact-checker", "verified memo citations"],
  ["developer-risk", "refreshed developer risk score"],
  ["market-intel", "ingested DLD weekly transactions"],
];
const userActions = ["approved memo", "moved mandate to Review", "commented on DD finding", "exported memo PDF", "created mandate", "edited underwriting assumptions"];

export const auditEvents: AuditEvent[] = Array.from({ length: 60 }, (_, i) => {
  const m = mandates[(i * 7) % mandates.length]!;
  const isAgent = i % 3 !== 1;
  if (isAgent) {
    const [agent, action] = agentActions[i % agentActions.length]!;
    const inTok = Math.round(between(8_000, 60_000));
    const outTok = Math.round(between(1_500, 9_000));
    return {
      id: `ev_${i}`,
      mandateId: m.id,
      actor: `${agent} agent`,
      actorType: "agent",
      action,
      detail: m.id,
      at: hoursAgo(i * 1.6 + 0.2),
      inputTokens: inTok,
      outputTokens: outTok,
      costUsd: +((inTok * 4 + outTok * 20) / 1_000_000).toFixed(4),
      durationMs: Math.round(between(9_000, 95_000)),
    };
  }
  return {
    id: `ev_${i}`,
    mandateId: m.id,
    actor: analysts[i % analysts.length]!.name,
    actorType: "user",
    action: userActions[i % userActions.length]!,
    detail: m.id,
    at: hoursAgo(i * 1.6 + 0.4),
  };
});

export const memos: Memo[] = mandates
  .filter((m) => ["memo", "review", "delivered"].includes(m.status))
  .map((m, i) => {
    const p = properties.find((x) => x.id === m.propertyId)!;
    return {
      id: `memo_${m.id}`,
      mandateId: m.id,
      title: `Investment Memo — ${p.name}`,
      status: m.status === "delivered" ? "Delivered" : m.status === "review" ? "In review" : i % 3 === 0 ? "Approved" : "Draft",
      lastEditedAt: m.updatedAt,
      lastEditedBy: analysts.find((a) => a.id === m.analystId)!.name,
      html: "",
    };
  });

export const documents: DocumentItem[] = [
  ...memos.map((memo, i) => ({
    id: `doc_m${i}`,
    title: memo.title,
    type: "Memo" as const,
    mandateId: memo.mandateId,
    clientId: mandates.find((m) => m.id === memo.mandateId)!.clientId,
    pages: 14 + (i % 9),
    sizeKb: 820 + i * 37,
    createdAt: memo.lastEditedAt,
  })),
  ...mandates.slice(0, 14).flatMap((m, i) => {
    const p = properties.find((x) => x.id === m.propertyId)!;
    const types = ["SPA", "Valuation", "Title Deed", "Research", "Statement"] as const;
    const t = types[i % types.length]!;
    return [
      {
        id: `doc_${i}`,
        title: `${t === "Statement" ? "Q3 Statement" : t} — ${p.name}`,
        type: t,
        mandateId: m.id,
        clientId: m.clientId,
        pages: 3 + (i % 20),
        sizeKb: 240 + i * 61,
        createdAt: hoursAgo(24 * (i + 3)),
      },
    ];
  }),
];

/* ---------- Client-side portfolio (demo client = Al Noor Family Office) ---------- */

export const DEMO_CLIENT_ID = "cl_01";

export const holdings: Holding[] = properties.slice(0, 9).map((p, i) => {
  const cost = round(between(3_000_000, 28_000_000), 100_000);
  const uplift = between(-0.04, 0.38);
  return {
    id: `hd_${i}`,
    clientId: DEMO_CLIENT_ID,
    propertyId: p.id,
    acquiredAt: hoursAgo(24 * (120 + i * 95)),
    costUsd: cost,
    valueUsd: round(cost * (1 + uplift), 10_000),
    irr: +(uplift * 30 + between(3, 7)).toFixed(1),
    cashYield: +between(3.2, 7.8).toFixed(1),
    status: p.status === "Ready" ? (uplift < 0 ? "Watch" : "Performing") : "Under construction",
  };
});

export const portfolioAlerts: PortfolioAlert[] = [
  { id: "al_1", clientId: DEMO_CLIENT_ID, severity: "high", title: "Handover delay signalled", detail: "Developer filed a RERA extension request for Horizon Crest phase 2 (+7 months).", at: hoursAgo(5) },
  { id: "al_2", clientId: DEMO_CLIENT_ID, severity: "medium", title: "Service charge increase", detail: "Palm Jumeirah community service charge up 11% YoY, compressing net yield by ~40bps.", at: hoursAgo(28) },
  { id: "al_3", clientId: DEMO_CLIENT_ID, severity: "low", title: "Valuation uplift", detail: "Dubai Hills comparable transactions support a 6.2% mark-up on your holding.", at: hoursAgo(52) },
  { id: "al_4", clientId: DEMO_CLIENT_ID, severity: "critical", title: "Escrow shortfall", detail: "Escrow audit shows 18% shortfall vs. construction progress for one off-plan asset.", at: hoursAgo(76) },
  { id: "al_5", clientId: DEMO_CLIENT_ID, severity: "low", title: "Lease renewed", detail: "Tenant renewed at Downtown unit 2304 at +8.5% on passing rent.", at: hoursAgo(130) },
];

export const clientRecommendations: ClientRecommendation[] = [
  { id: "rc_1", clientId: DEMO_CLIENT_ID, type: "Exit window", message: "Marina holding is trading 14% above your P50 exit value. Consider a partial exit before 2027 supply lands.", propertyId: properties[1]!.id, at: hoursAgo(6) },
  { id: "rc_2", clientId: DEMO_CLIENT_ID, type: "New opportunity", message: "Saadiyat branded residence matches your mandate: 7.1% gross yield, Aldar-delivered, Q4 2027 handover.", propertyId: properties[8]!.id, at: hoursAgo(20) },
  { id: "rc_3", clientId: DEMO_CLIENT_ID, type: "Risk", message: "Concentration in off-plan Dubai is 46% of NAV, above your 35% policy limit.", at: hoursAgo(40) },
  { id: "rc_4", clientId: DEMO_CLIENT_ID, type: "Refinance", message: "Local bank rates eased 50bps. Refinancing the Business Bay facility could add ~0.6pp to levered IRR.", propertyId: properties[4]!.id, at: hoursAgo(64) },
  { id: "rc_5", clientId: DEMO_CLIENT_ID, type: "Rebalance", message: "Worli prime residential is screening attractively vs. Dubai prime on a currency-adjusted basis.", propertyId: properties[3]!.id, at: hoursAgo(90) },
];

/* ---------- Market ---------- */

const monthNames = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
export const marketMonths: MarketMonth[] = monthNames.map((m, i) => ({
  month: m,
  transactions: Math.round(14_200 + i * 420 + Math.sin(i * 1.3) * 1_600),
  medianPriceSqft: Math.round(1_540 + i * 18 + Math.sin(i * 0.9) * 22),
  offPlanShare: +(58 + Math.sin(i * 0.7) * 5 + i * 0.4).toFixed(1),
}));

export const supplyPipeline: SupplyPoint[] = [
  { year: "2025", units: 38_400 },
  { year: "2026", units: 52_900 },
  { year: "2027", units: 71_200 },
  { year: "2028", units: 64_500 },
  { year: "2029", units: 41_800 },
];

export const priceTrend = Array.from({ length: 24 }, (_, i) => ({
  month: new Date(2024, 9 + i, 1).toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
  dubai: Math.round(1_320 + i * 21 + Math.sin(i * 0.6) * 25),
  abuDhabi: Math.round(1_020 + i * 13 + Math.sin(i * 0.5 + 1) * 18),
  mumbai: Math.round(1_180 + i * 9 + Math.sin(i * 0.4 + 2) * 15),
}));

export const heatmapRegions = ["Dubai", "Abu Dhabi", "Ras Al Khaimah", "Sharjah", "Mumbai", "Bengaluru", "Gurugram"];
export const heatmapClasses = ["Residential", "Branded", "Office", "Retail", "Hospitality", "Logistics"];
export const heatmap: { region: string; assetClass: string; value: number }[] = heatmapRegions.flatMap((r, ri) =>
  heatmapClasses.map((c, ci) => ({
    region: r,
    assetClass: c,
    value: +(Math.sin(ri * 1.7 + ci * 0.9) * 9 + (ri < 2 ? 8 : 3) + (ci === 0 ? 4 : 0)).toFixed(1),
  })),
);

export const users: User[] = [
  ...analysts.map((a, i) => ({
    id: a.id,
    name: a.name,
    email: `${a.name.split(" ")[0]!.toLowerCase()}@propfolios.com`,
    role: (i === 2 ? "admin" : "analyst") as User["role"],
    lastActive: hoursAgo(i * 3 + 1),
  })),
  ...clients.slice(0, 6).map((c, i) => ({
    id: `us_${c.id}`,
    name: c.name,
    email: `office@${c.name.split(" ")[0]!.toLowerCase().replace(/[^a-z]/g, "")}.com`,
    role: "client" as const,
    lastActive: hoursAgo(i * 17 + 5),
  })),
];

export { MANDATE_STAGES };
