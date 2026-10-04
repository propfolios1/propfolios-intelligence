/**
 * Market registry: the facts each brokerage module localises on. UAE and India
 * carry the full regulatory engine (closing checklists, tax calculators,
 * registry parsers); the other markets are localised for leads, listings,
 * syndication, rentals and fee invoicing, with their regulator workflows on the
 * roadmap. Pages and the public site read this registry; nothing is claimed
 * for a market that is not listed here.
 */

export const MARKET_CODES = ["AE", "IN", "GB", "SG", "AU", "US"] as const;
export type MarketCode = (typeof MARKET_CODES)[number];

export type Coverage = "full" | "localised";

export interface Portal {
  key: string;
  name: string;
  /** Inbound lead capture: the portal posts or forwards each enquiry to the firm's endpoint. */
  leads: boolean;
  /** Listing syndication: the portal pulls the firm's XML feed. */
  feed: boolean;
}

export interface Market {
  code: MarketCode;
  name: string;
  flag: string;
  coverage: Coverage;
  currency: "AED" | "INR" | "GBP" | "SGD" | "AUD" | "USD";
  /** Principal city on the landing map, in a 0–1000 by 0–500 equirectangular frame. */
  map: { x: number; y: number };
  cities: string[];
  regulators: { name: string; role: string }[];
  /** Tax charged on an agency fee. */
  feeTax: { name: string; ratePct: number };
  transferTax: string;
  /** What must appear on a listing before it can be advertised. */
  listingPermit: string;
  agentLicence: string;
  amlRegime: string;
  areaUnit: "sqft" | "sqm";
  tenancyRegistration: string | null;
  portals: Portal[];
  /** Workflows available in this market. */
  workflows: { label: string; available: boolean }[];
}

const W = (full: boolean) => [
  { label: "Lead capture and scoring", available: true },
  { label: "Listing syndication feeds", available: true },
  { label: "Fee invoicing with local tax", available: true },
  { label: "Rental and tenancy management", available: true },
  { label: "Regulator closing checklist", available: full },
  { label: "Registry and title parsers", available: full },
  { label: "Transfer-tax calculator", available: full },
];

export const MARKETS: Record<MarketCode, Market> = {
  AE: {
    code: "AE",
    name: "United Arab Emirates",
    flag: "🇦🇪",
    coverage: "full",
    currency: "AED",
    map: { x: 654, y: 180 },
    cities: ["Dubai", "Abu Dhabi", "Sharjah"],
    regulators: [
      { name: "Dubai Land Department", role: "Title, transfers and the Trakheesi advertising permit" },
      { name: "RERA Dubai", role: "Broker licensing, escrow and off-plan (Oqood) registration" },
      { name: "ADREC", role: "Abu Dhabi registration, broker licensing and Tawtheeq tenancies" },
    ],
    feeTax: { name: "VAT", ratePct: 5 },
    transferTax: "DLD transfer fee of 4% in Dubai; 2% in Abu Dhabi",
    listingPermit: "Trakheesi permit number (Dubai) or ADREC permit",
    agentLicence: "RERA broker registration number (BRN)",
    amlRegime: "Federal Decree-Law 20 of 2018; goAML reporting",
    areaUnit: "sqft",
    tenancyRegistration: "Ejari (Dubai), Tawtheeq (Abu Dhabi)",
    portals: [
      { key: "bayut", name: "Bayut", leads: true, feed: true },
      { key: "propertyfinder", name: "Property Finder", leads: true, feed: true },
      { key: "dubizzle", name: "Dubizzle", leads: true, feed: true },
    ],
    workflows: W(true),
  },
  IN: {
    code: "IN",
    name: "India",
    flag: "🇮🇳",
    coverage: "full",
    currency: "INR",
    map: { x: 702, y: 197 },
    cities: ["Mumbai", "Pune", "Goa"],
    regulators: [
      { name: "MahaRERA", role: "Project and agent registration in Maharashtra" },
      { name: "Goa RERA", role: "Project and agent registration in Goa" },
      { name: "IGR Maharashtra", role: "Registration, stamp duty and Ready Reckoner rates" },
    ],
    feeTax: { name: "GST", ratePct: 18 },
    transferTax: "Stamp duty of 5% to 6% in Maharashtra plus 1% registration; TDS of 1% on purchases of ₹50 lakh and above",
    listingPermit: "RERA project registration number",
    agentLicence: "State RERA agent registration number",
    amlRegime: "PMLA 2002; FIU-IND reporting",
    areaUnit: "sqft",
    tenancyRegistration: "Leave and licence registration (Maharashtra)",
    portals: [
      { key: "magicbricks", name: "MagicBricks", leads: true, feed: true },
      { key: "99acres", name: "99acres", leads: true, feed: true },
      { key: "housing", name: "Housing.com", leads: true, feed: true },
      { key: "nobroker", name: "NoBroker", leads: true, feed: false },
    ],
    workflows: W(true),
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    coverage: "localised",
    currency: "GBP",
    map: { x: 500, y: 107 },
    cities: ["London", "Manchester", "Edinburgh"],
    regulators: [
      { name: "HMRC", role: "Anti-money-laundering supervision of estate agency businesses" },
      { name: "NTSELAT", role: "Estate agency standards and material information (Parts A to C)" },
      { name: "The Property Ombudsman", role: "Consumer redress scheme membership" },
    ],
    feeTax: { name: "VAT", ratePct: 20 },
    transferTax: "Stamp Duty Land Tax in England and Northern Ireland; LBTT in Scotland; LTT in Wales",
    listingPermit: "Material information disclosure (Parts A to C)",
    agentLicence: "Redress scheme membership and HMRC AML registration",
    amlRegime: "Money Laundering Regulations 2017",
    areaUnit: "sqft",
    tenancyRegistration: "Deposit protection scheme (England and Wales)",
    portals: [
      { key: "rightmove", name: "Rightmove", leads: true, feed: true },
      { key: "zoopla", name: "Zoopla", leads: true, feed: true },
      { key: "onthemarket", name: "OnTheMarket", leads: true, feed: true },
    ],
    workflows: W(false),
  },
  SG: {
    code: "SG",
    name: "Singapore",
    flag: "🇸🇬",
    coverage: "localised",
    currency: "SGD",
    map: { x: 788, y: 246 },
    cities: ["Singapore"],
    regulators: [
      { name: "CEA", role: "Licensing of estate agencies and registration of salespersons" },
      { name: "URA", role: "Private property caveats and planning data" },
      { name: "HDB", role: "Public housing resale procedures" },
    ],
    feeTax: { name: "GST", ratePct: 9 },
    transferTax: "Buyer's Stamp Duty, Additional Buyer's Stamp Duty and Seller's Stamp Duty",
    listingPermit: "CEA salesperson registration number on every advertisement",
    agentLicence: "CEA estate agent licence and salesperson registration",
    amlRegime: "Estate Agents Act and CEA AML/CFT guidelines",
    areaUnit: "sqft",
    tenancyRegistration: null,
    portals: [
      { key: "propertyguru", name: "PropertyGuru", leads: true, feed: true },
      { key: "99co", name: "99.co", leads: true, feed: true },
      { key: "edgeprop", name: "EdgeProp", leads: true, feed: true },
    ],
    workflows: W(false),
  },
  AU: {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    coverage: "localised",
    currency: "AUD",
    map: { x: 920, y: 344 },
    cities: ["Sydney", "Melbourne", "Brisbane"],
    regulators: [
      { name: "NSW Fair Trading", role: "Agent licensing and trust accounts in New South Wales" },
      { name: "Consumer Affairs Victoria", role: "Agent licensing and trust accounts in Victoria" },
      { name: "AUSTRAC", role: "AML/CTF obligations for real estate professionals" },
    ],
    feeTax: { name: "GST", ratePct: 10 },
    transferTax: "State transfer (stamp) duty; FIRB approval and surcharges for foreign buyers",
    listingPermit: "Licensed agent details and state disclosure statements",
    agentLicence: "State or territory real estate licence",
    amlRegime: "AML/CTF Act as extended to real estate professionals",
    areaUnit: "sqm",
    tenancyRegistration: "State rental bond lodgement",
    portals: [
      { key: "realestate-au", name: "realestate.com.au", leads: true, feed: true },
      { key: "domain", name: "Domain", leads: true, feed: true },
    ],
    workflows: W(false),
  },
  US: {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    coverage: "localised",
    currency: "USD",
    map: { x: 294, y: 137 },
    cities: ["New York", "Miami", "Los Angeles"],
    regulators: [
      { name: "State real estate commissions", role: "Broker and salesperson licensing" },
      { name: "Local MLS", role: "Listing cooperation and data rules" },
      { name: "FinCEN", role: "Reporting on certain non-financed residential transfers" },
    ],
    feeTax: { name: "Sales tax", ratePct: 0 },
    transferTax: "State and county transfer taxes; FIRPTA withholding for foreign sellers",
    listingPermit: "MLS listing agreement and brokerage disclosure",
    agentLicence: "State real estate licence",
    amlRegime: "Bank Secrecy Act; FinCEN real estate reporting",
    areaUnit: "sqft",
    tenancyRegistration: null,
    portals: [
      { key: "zillow", name: "Zillow", leads: true, feed: true },
      { key: "realtor", name: "Realtor.com", leads: true, feed: true },
      { key: "homes", name: "Homes.com", leads: true, feed: true },
    ],
    workflows: W(false),
  },
};

/** Channels that are not portals but still produce leads. */
export const DIRECT_SOURCES = [
  { key: "website", name: "Firm website" },
  { key: "whatsapp", name: "WhatsApp" },
  { key: "referral", name: "Client referral" },
  { key: "walk_in", name: "Walk-in or call" },
  { key: "meta_ads", name: "Meta lead ads" },
  { key: "google_ads", name: "Google lead forms" },
] as const;

export const ALL_PORTALS: (Portal & { market: MarketCode })[] = MARKET_CODES.flatMap((m) => MARKETS[m].portals.map((p) => ({ ...p, market: m })));
export const PORTAL_INDEX: Record<string, Portal & { market: MarketCode }> = Object.fromEntries(ALL_PORTALS.map((p) => [p.key, p]));

/** Every source a lead can arrive from: portals and direct channels. */
export const LEAD_SOURCES: { key: string; name: string; market: MarketCode | null }[] = [...ALL_PORTALS.map((p) => ({ key: p.key, name: p.name, market: p.market })), ...DIRECT_SOURCES.map((d) => ({ key: d.key, name: d.name, market: null }))];
export const SOURCE_NAME: Record<string, string> = Object.fromEntries(LEAD_SOURCES.map((s) => [s.key, s.name]));

/** The advertising permit's name for a listing in this city (Dubai and Abu Dhabi issue different permits). */
export function permitLabel(code: string, city?: string | null) {
  if (code === "AE") return city === "Abu Dhabi" ? "ADREC permit" : "Trakheesi permit";
  if (code === "IN") return "RERA registration";
  return MARKETS[code as MarketCode]?.listingPermit ?? "Permit";
}

export const marketOf = (code: string | null | undefined): Market => MARKETS[(code ?? "AE") as MarketCode] ?? MARKETS.AE;
