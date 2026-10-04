import type { CatalogueMarket } from "@/db/schema-core";
import type { MarketCode } from "@/lib/markets";

/**
 * Country profiles for workspace seeding: the developers, projects,
 * communities, people and registration formats a brokerage in that market
 * works with every day. Figures are representative of each market's price
 * levels, not quotations. Every person and company in the demonstration data
 * that is not a real developer is invented.
 */

export type Project = { key: string; name: string; dev: string; city: string; region: string; community: string; assetClass: "Apartment" | "Villa" | "Townhouse" | "Penthouse" | "Condominium" | "House"; status: "ready" | "under_construction" | "off_plan"; handover: string; ppsf: number; priceMin: number; priceMax: number; units: number; yieldPct: number; lat: number; lng: number };
export type Community = { city: string; community: string; types: { type: string; beds: [number, number]; sqft: [number, number] }[]; ppsf: number; rentYieldPct: number };

export interface MarketProfile {
  code: MarketCode;
  currency: string;
  /** AED per unit of the local currency (indicative; AED is pegged at 3.6725 per USD). */
  aedPer: number;
  developers: { key: string; name: string; hq: string; founded: number; listed: boolean; deliveryPct: number; financialHealth: number; summary: string }[];
  projects: Project[];
  communities: Community[];
  regions: string[];
  first: string[];
  last: string[];
  agents: { key: string; name: string; title: string }[];
  clients: { key: string; name: string; type: "HNWI" | "UHNWI" | "Family Office"; nationality: string; residency: string; domicile: string; aum: number; risk: "Conservative" | "Balanced" | "Growth" }[];
  phone: (i: number) => string;
  permit: (i: number, city: string) => string | null;
  registration: (i: number) => string;
  rentPeriod: "annual" | "monthly";
  counterparty: string[];
}

const pad = (n: number, w: number) => String(n).padStart(w, "0");

export const PROFILES: Record<MarketCode, MarketProfile> = {
  AE: {
    code: "AE",
    currency: "AED",
    aedPer: 1,
    developers: [
      { key: "emaar", name: "Emaar Properties", hq: "Dubai", founded: 1997, listed: true, deliveryPct: 94, financialHealth: 88, summary: "Master developer of Downtown Dubai, Dubai Hills Estate and Dubai Creek Harbour; listed on the Dubai Financial Market." },
      { key: "damac", name: "DAMAC Properties", hq: "Dubai", founded: 2002, listed: false, deliveryPct: 82, financialHealth: 71, summary: "Luxury residential developer with branded towers and villa communities across Dubai." },
      { key: "aldar", name: "Aldar Properties", hq: "Abu Dhabi", founded: 2004, listed: true, deliveryPct: 93, financialHealth: 86, summary: "Abu Dhabi's largest developer: Saadiyat, Yas and Al Reem communities; listed on ADX." },
    ],
    projects: [
      { key: "downtown-views-ii", name: "Downtown Views II", dev: "emaar", city: "Dubai", region: "Dubai", community: "Downtown Dubai", assetClass: "Apartment", status: "ready", handover: "Completed Q3 2021", ppsf: 2_650, priceMin: 1_700_000, priceMax: 5_200_000, units: 920, yieldPct: 6.2, lat: 25.1915, lng: 55.2808 },
      { key: "marina-gate", name: "Marina Gate", dev: "emaar", city: "Dubai", region: "Dubai", community: "Dubai Marina", assetClass: "Apartment", status: "ready", handover: "Completed Q4 2018", ppsf: 2_250, priceMin: 1_400_000, priceMax: 6_000_000, units: 1_100, yieldPct: 6.6, lat: 25.0871, lng: 55.1468 },
      { key: "damac-lagoons", name: "DAMAC Lagoons, Portofino", dev: "damac", city: "Dubai", region: "Dubai", community: "DAMAC Lagoons", assetClass: "Townhouse", status: "under_construction", handover: "Q2 2027", ppsf: 1_250, priceMin: 1_900_000, priceMax: 3_600_000, units: 640, yieldPct: 6.0, lat: 25.0208, lng: 55.2369 },
      { key: "jvc-binghatti", name: "Binghatti Corner, JVC", dev: "damac", city: "Dubai", region: "Dubai", community: "Jumeirah Village Circle", assetClass: "Apartment", status: "ready", handover: "Completed Q1 2024", ppsf: 1_250, priceMin: 550_000, priceMax: 1_600_000, units: 380, yieldPct: 7.6, lat: 25.0611, lng: 55.2091 },
      { key: "saadiyat-grove", name: "Saadiyat Grove", dev: "aldar", city: "Abu Dhabi", region: "Abu Dhabi", community: "Saadiyat Island", assetClass: "Villa", status: "off_plan", handover: "Q4 2027", ppsf: 2_350, priceMin: 4_800_000, priceMax: 14_000_000, units: 520, yieldPct: 5.4, lat: 24.5405, lng: 54.4317 },
      { key: "yas-acres", name: "Yas Acres", dev: "aldar", city: "Abu Dhabi", region: "Abu Dhabi", community: "Yas Island", assetClass: "Townhouse", status: "ready", handover: "Completed Q2 2022", ppsf: 1_450, priceMin: 2_600_000, priceMax: 7_500_000, units: 1_315, yieldPct: 6.1, lat: 24.4957, lng: 54.6213 },
    ],
    communities: [
      { city: "Dubai", community: "Downtown Dubai", ppsf: 2_650, rentYieldPct: 6.0, types: [{ type: "Apartment", beds: [1, 3], sqft: [750, 1_900] }, { type: "Penthouse", beds: [4, 5], sqft: [4_000, 6_500] }] },
      { city: "Dubai", community: "Dubai Marina", ppsf: 2_250, rentYieldPct: 6.5, types: [{ type: "Apartment", beds: [0, 3], sqft: [450, 1_850] }] },
      { city: "Dubai", community: "Jumeirah Village Circle", ppsf: 1_250, rentYieldPct: 7.6, types: [{ type: "Apartment", beds: [0, 2], sqft: [400, 1_150] }, { type: "Townhouse", beds: [3, 4], sqft: [1_900, 2_600] }] },
      { city: "Dubai", community: "Dubai Hills Estate", ppsf: 2_100, rentYieldPct: 5.6, types: [{ type: "Villa", beds: [4, 6], sqft: [3_200, 6_000] }, { type: "Apartment", beds: [1, 3], sqft: [700, 1_700] }] },
      { city: "Abu Dhabi", community: "Saadiyat Island", ppsf: 2_350, rentYieldPct: 5.3, types: [{ type: "Villa", beds: [4, 6], sqft: [4_000, 7_500] }, { type: "Apartment", beds: [1, 3], sqft: [800, 2_000] }] },
      { city: "Abu Dhabi", community: "Yas Island", ppsf: 1_450, rentYieldPct: 6.2, types: [{ type: "Townhouse", beds: [2, 4], sqft: [1_600, 2_900] }] },
    ],
    regions: ["Dubai", "Abu Dhabi"],
    first: ["Ahmed", "Fatima", "Omar", "Layla", "Rahul", "Sarah", "Hassan", "Elena", "Vikram", "Noura", "James", "Mei", "Khalid", "Anika", "David", "Mariam", "Arjun", "Chloe", "Sultan", "Grace"],
    last: ["Al Mansoori", "Khan", "Al Suwaidi", "Petrova", "Shah", "Whitfield", "Qureshi", "Haddad", "Rao", "Al Falasi", "O'Connor", "Cohen", "Pillai", "Dubois", "Al Mazrouei", "Okafor"],
    agents: [
      { key: "agent-1", name: "Reem Al Hashemi", title: "Senior Broker" },
      { key: "agent-2", name: "Daniel Mensah", title: "Broker" },
      { key: "agent-3", name: "Priyanka Das", title: "Leasing Consultant" },
    ],
    clients: [
      { key: "c1", name: "Saeed Al Nuaimi", type: "UHNWI", nationality: "UAE", residency: "UAE", domicile: "UAE", aum: 48_000_000, risk: "Balanced" },
      { key: "c2", name: "Rohit and Nisha Bhatia", type: "HNWI", nationality: "India", residency: "UAE", domicile: "India", aum: 9_500_000, risk: "Growth" },
      { key: "c3", name: "Charlotte Ames", type: "HNWI", nationality: "United Kingdom", residency: "UAE", domicile: "United Kingdom", aum: 6_200_000, risk: "Conservative" },
      { key: "c4", name: "Al Waha Family Office", type: "Family Office", nationality: "UAE", residency: "UAE", domicile: "UAE", aum: 120_000_000, risk: "Balanced" },
      { key: "c5", name: "Viktor Sorensen", type: "HNWI", nationality: "Denmark", residency: "Denmark", domicile: "Denmark", aum: 7_800_000, risk: "Growth" },
    ],
    phone: (i) => `+97150${pad(1_000_000 + i * 731_313, 7).slice(0, 7)}`,
    permit: (i, city) => (city === "Abu Dhabi" ? `ADREC-${2026}${pad(4100 + i * 37, 6)}` : `71${pad(20_000_000 + i * 97_331, 8).slice(0, 8)}`),
    registration: (i) => `DLD Project ${3000 + i * 17}`,
    rentPeriod: "annual",
    counterparty: ["Private vendor (UK resident)", "Marcus and Helen Whitfield", "Al Qasimi family", "Emaar Properties sales office"],
  },
  IN: {
    code: "IN",
    currency: "INR",
    aedPer: 1 / 22.6,
    developers: [
      { key: "lodha", name: "Lodha (Macrotech Developers)", hq: "Mumbai", founded: 1980, listed: true, deliveryPct: 89, financialHealth: 79, summary: "Mumbai's largest residential developer by sales; listed on the NSE and BSE." },
      { key: "oberoi", name: "Oberoi Realty", hq: "Mumbai", founded: 1980, listed: true, deliveryPct: 92, financialHealth: 90, summary: "Premium Mumbai developer with a low-leverage balance sheet; Worli, Goregaon and Borivali." },
      { key: "prestige", name: "Prestige Group", hq: "Bengaluru", founded: 1986, listed: true, deliveryPct: 87, financialHealth: 77, summary: "Multi-city developer expanding in Mumbai and Goa; listed on the NSE." },
    ],
    projects: [
      { key: "lodha-bandra", name: "Lodha Bandra Residences", dev: "lodha", city: "Mumbai", region: "Mumbai", community: "Bandra West", assetClass: "Apartment", status: "under_construction", handover: "Q4 2027", ppsf: 72_000, priceMin: 60_000_000, priceMax: 180_000_000, units: 310, yieldPct: 2.6, lat: 19.0596, lng: 72.8295 },
      { key: "oberoi-andheri", name: "Oberoi Sky City, Andheri", dev: "oberoi", city: "Mumbai", region: "Mumbai", community: "Andheri West", assetClass: "Apartment", status: "ready", handover: "Completed Q1 2023", ppsf: 34_000, priceMin: 22_000_000, priceMax: 65_000_000, units: 1_200, yieldPct: 3.1, lat: 19.1364, lng: 72.8296 },
      { key: "lodha-powai", name: "Lodha Sterling, Powai", dev: "lodha", city: "Mumbai", region: "Mumbai", community: "Powai", assetClass: "Apartment", status: "ready", handover: "Completed Q2 2022", ppsf: 31_000, priceMin: 18_000_000, priceMax: 52_000_000, units: 860, yieldPct: 3.2, lat: 19.1176, lng: 72.906 },
      { key: "prestige-assagao", name: "Prestige Goa Villas, Assagao", dev: "prestige", city: "Goa", region: "Goa", community: "Assagao", assetClass: "Villa", status: "off_plan", handover: "Q2 2028", ppsf: 18_500, priceMin: 55_000_000, priceMax: 120_000_000, units: 48, yieldPct: 4.4, lat: 15.6034, lng: 73.7651 },
      { key: "anjuna-residences", name: "Anjuna Bay Residences", dev: "prestige", city: "Goa", region: "Goa", community: "Anjuna", assetClass: "Apartment", status: "under_construction", handover: "Q3 2027", ppsf: 14_000, priceMin: 9_500_000, priceMax: 26_000_000, units: 140, yieldPct: 5.2, lat: 15.5868, lng: 73.7448 },
      { key: "panjim-heights", name: "Oberoi Panjim Heights", dev: "oberoi", city: "Goa", region: "Goa", community: "Panjim", assetClass: "Apartment", status: "ready", handover: "Completed Q4 2023", ppsf: 12_500, priceMin: 8_000_000, priceMax: 21_000_000, units: 220, yieldPct: 4.6, lat: 15.4909, lng: 73.8278 },
    ],
    communities: [
      { city: "Mumbai", community: "Bandra West", ppsf: 68_000, rentYieldPct: 2.6, types: [{ type: "Apartment", beds: [2, 4], sqft: [850, 2_400] }] },
      { city: "Mumbai", community: "Andheri West", ppsf: 33_000, rentYieldPct: 3.1, types: [{ type: "Apartment", beds: [1, 3], sqft: [550, 1_500] }] },
      { city: "Mumbai", community: "Powai", ppsf: 30_000, rentYieldPct: 3.3, types: [{ type: "Apartment", beds: [1, 3], sqft: [600, 1_600] }] },
      { city: "Goa", community: "Assagao", ppsf: 18_000, rentYieldPct: 4.5, types: [{ type: "Villa", beds: [3, 5], sqft: [2_800, 5_200] }] },
      { city: "Goa", community: "Anjuna", ppsf: 14_000, rentYieldPct: 5.2, types: [{ type: "Apartment", beds: [1, 3], sqft: [650, 1_400] }, { type: "Villa", beds: [3, 4], sqft: [2_200, 3_600] }] },
      { city: "Goa", community: "Panjim", ppsf: 12_500, rentYieldPct: 4.6, types: [{ type: "Apartment", beds: [2, 3], sqft: [900, 1_600] }] },
    ],
    regions: ["Mumbai", "Goa"],
    first: ["Neha", "Aditya", "Sameer", "Kavya", "Rohit", "Ishita", "Farhan", "Pooja", "Anand", "Meera", "Siddharth", "Tanvi", "Karan", "Riya", "Vikrant", "Sneha", "Arvind", "Shreya", "Nikhil", "Aparna"],
    last: ["Kulkarni", "Joshi", "Deshpande", "Menon", "Bhatia", "Gupta", "Sheikh", "Naik", "Iyer", "Fernandes", "Rane", "Shetty", "Malhotra", "D'Souza", "Patil", "Kamat"],
    agents: [
      { key: "agent-1", name: "Nikhil Sawant", title: "Senior Relationship Manager" },
      { key: "agent-2", name: "Aparna Iyer", title: "Relationship Manager" },
      { key: "agent-3", name: "Varun Kamat", title: "Goa Desk" },
    ],
    clients: [
      { key: "c1", name: "Rajesh and Anita Mehta", type: "HNWI", nationality: "India", residency: "UAE", domicile: "India", aum: 4_200_000, risk: "Balanced" },
      { key: "c2", name: "Sunita Kapoor", type: "UHNWI", nationality: "India", residency: "India", domicile: "India", aum: 38_000_000, risk: "Conservative" },
      { key: "c3", name: "Desai Family Office", type: "Family Office", nationality: "India", residency: "India", domicile: "India", aum: 95_000_000, risk: "Balanced" },
      { key: "c4", name: "Arjun Reddy", type: "HNWI", nationality: "India", residency: "United Kingdom", domicile: "India", aum: 5_600_000, risk: "Growth" },
      { key: "c5", name: "Clara Fernandes", type: "HNWI", nationality: "Portugal", residency: "India", domicile: "Portugal", aum: 3_100_000, risk: "Growth" },
    ],
    phone: (i) => `+9198${pad(20_000_000 + i * 7_313_131, 8).slice(0, 8)}`,
    permit: (i, city) => (city === "Goa" ? `PRGO${pad(4_230_000 + i * 137, 8)}` : `P5180${pad(1_200_000 + i * 4_441, 7).slice(0, 7)}`),
    registration: (i) => `MahaRERA P5180${pad(3_300_000 + i * 2_281, 7).slice(0, 7)}`,
    rentPeriod: "monthly",
    counterparty: ["Mehra family trust", "Private vendor (Pune)", "Lodha sales office", "Kamat and Sons HUF"],
  },
  GB: {
    code: "GB",
    currency: "GBP",
    aedPer: 4.88,
    developers: [
      { key: "berkeley", name: "Berkeley Group", hq: "Cobham", founded: 1976, listed: true, deliveryPct: 93, financialHealth: 87, summary: "London-focused residential developer listed on the LSE; regeneration and riverside schemes." },
      { key: "grosvenor", name: "Grosvenor Britain and Ireland", hq: "London", founded: 1677, listed: false, deliveryPct: 95, financialHealth: 92, summary: "Private estate owner and developer across Mayfair and Belgravia." },
      { key: "chelsea-dev", name: "Cadogan Estates", hq: "London", founded: 1717, listed: false, deliveryPct: 94, financialHealth: 90, summary: "Private estate in Chelsea managing and redeveloping residential and retail property." },
    ],
    projects: [
      { key: "kensington-row", name: "Kensington Row", dev: "berkeley", city: "London", region: "London", community: "Kensington", assetClass: "Apartment", status: "ready", handover: "Completed 2021", ppsf: 1_650, priceMin: 1_100_000, priceMax: 4_500_000, units: 469, yieldPct: 3.3, lat: 51.4955, lng: -0.1946 },
      { key: "chelsea-creek", name: "Chelsea Creek", dev: "berkeley", city: "London", region: "London", community: "Chelsea", assetClass: "Apartment", status: "ready", handover: "Completed 2022", ppsf: 1_500, priceMin: 900_000, priceMax: 3_800_000, units: 1_200, yieldPct: 3.6, lat: 51.4753, lng: -0.1823 },
      { key: "mayfair-mews", name: "South Molton Mews", dev: "grosvenor", city: "London", region: "London", community: "Mayfair", assetClass: "House", status: "under_construction", handover: "Q3 2027", ppsf: 3_100, priceMin: 4_500_000, priceMax: 16_000_000, units: 24, yieldPct: 2.4, lat: 51.5129, lng: -0.1478 },
      { key: "belgravia-gate", name: "Eaton Gate Residences", dev: "grosvenor", city: "London", region: "London", community: "Belgravia", assetClass: "Apartment", status: "off_plan", handover: "Q1 2028", ppsf: 2_900, priceMin: 3_200_000, priceMax: 12_000_000, units: 36, yieldPct: 2.6, lat: 51.4944, lng: -0.1567 },
      { key: "sloane-place", name: "Sloane Place", dev: "chelsea-dev", city: "London", region: "London", community: "Chelsea", assetClass: "Apartment", status: "ready", handover: "Completed 2020", ppsf: 2_200, priceMin: 1_800_000, priceMax: 7_500_000, units: 88, yieldPct: 2.9, lat: 51.4924, lng: -0.1586 },
      { key: "marylebone-square", name: "Marylebone Square", dev: "berkeley", city: "London", region: "London", community: "Marylebone", assetClass: "Apartment", status: "ready", handover: "Completed 2023", ppsf: 1_950, priceMin: 1_300_000, priceMax: 6_000_000, units: 54, yieldPct: 3.0, lat: 51.5197, lng: -0.1527 },
    ],
    communities: [
      { city: "London", community: "Kensington", ppsf: 1_650, rentYieldPct: 3.3, types: [{ type: "Apartment", beds: [1, 3], sqft: [550, 1_600] }, { type: "House", beds: [4, 5], sqft: [2_400, 4_200] }] },
      { city: "London", community: "Chelsea", ppsf: 1_700, rentYieldPct: 3.4, types: [{ type: "Apartment", beds: [1, 3], sqft: [600, 1_700] }, { type: "House", beds: [3, 5], sqft: [1_900, 3_800] }] },
      { city: "London", community: "Mayfair", ppsf: 2_800, rentYieldPct: 2.6, types: [{ type: "Apartment", beds: [1, 4], sqft: [700, 2_600] }] },
      { city: "London", community: "Marylebone", ppsf: 1_850, rentYieldPct: 3.1, types: [{ type: "Apartment", beds: [1, 3], sqft: [550, 1_500] }] },
      { city: "London", community: "Notting Hill", ppsf: 1_500, rentYieldPct: 3.5, types: [{ type: "House", beds: [3, 5], sqft: [1_700, 3_400] }, { type: "Apartment", beds: [1, 2], sqft: [500, 1_000] }] },
    ],
    regions: ["London"],
    first: ["Charlotte", "Oliver", "Amara", "William", "Sophie", "Rajiv", "Eleanor", "Benedict", "Isla", "Daniel", "Freya", "George", "Harriet", "Tom", "Alice", "Hugo", "Priya", "Edward", "Lucy", "Sebastian"],
    last: ["Hughes", "Bennett", "Okoye", "Grant", "Laurent", "Mehta", "Price", "Shaw", "McKenzie", "Reyes", "Lindqvist", "Asante", "Cole", "Ashworth", "Fenwick", "Hale"],
    agents: [
      { key: "agent-1", name: "Harriet Cole", title: "Senior Negotiator" },
      { key: "agent-2", name: "Tomasz Nowak", title: "Lettings Manager" },
      { key: "agent-3", name: "Imogen Blake", title: "Negotiator" },
    ],
    clients: [
      { key: "c1", name: "Alexander Harcourt", type: "UHNWI", nationality: "United Kingdom", residency: "United Kingdom", domicile: "United Kingdom", aum: 18_000_000, risk: "Conservative" },
      { key: "c2", name: "Leila Haddad", type: "HNWI", nationality: "Lebanon", residency: "United Kingdom", domicile: "Lebanon", aum: 4_500_000, risk: "Balanced" },
      { key: "c3", name: "Kensington Holdings LLP", type: "Family Office", nationality: "United Kingdom", residency: "United Kingdom", domicile: "United Kingdom", aum: 60_000_000, risk: "Balanced" },
      { key: "c4", name: "Michael Chen", type: "HNWI", nationality: "Singapore", residency: "Singapore", domicile: "Singapore", aum: 7_200_000, risk: "Growth" },
      { key: "c5", name: "Sofia Romano", type: "HNWI", nationality: "Italy", residency: "United Kingdom", domicile: "Italy", aum: 3_900_000, risk: "Growth" },
    ],
    phone: (i) => `+4479${pad(10_000_000 + i * 6_131_313, 8).slice(0, 8)}`,
    permit: () => null,
    registration: (i) => `HM Land Registry NGL${pad(910_000 + i * 113, 6)}`,
    rentPeriod: "monthly",
    counterparty: ["Private vendor (chain-free)", "Grosvenor sales suite", "Ashworth family trust", "Executors of the late R. Fenwick"],
  },
  SG: {
    code: "SG",
    currency: "SGD",
    aedPer: 2.82,
    developers: [
      { key: "cdl", name: "City Developments Limited", hq: "Singapore", founded: 1963, listed: true, deliveryPct: 94, financialHealth: 85, summary: "SGX-listed developer of condominiums across the Core Central Region." },
      { key: "far-east", name: "Far East Organization", hq: "Singapore", founded: 1960, listed: false, deliveryPct: 93, financialHealth: 86, summary: "Singapore's largest private property developer; Orchard and Marina Bay residences." },
      { key: "guocoland", name: "GuocoLand", hq: "Singapore", founded: 1978, listed: true, deliveryPct: 91, financialHealth: 80, summary: "Integrated developments including Wallich Residence and Midtown Bay." },
    ],
    projects: [
      { key: "orchard-sophia", name: "Orchard Sophia", dev: "cdl", city: "Singapore", region: "Core Central Region", community: "Orchard", assetClass: "Condominium", status: "ready", handover: "TOP 2023", ppsf: 2_900, priceMin: 1_500_000, priceMax: 5_800_000, units: 78, yieldPct: 3.1, lat: 1.3016, lng: 103.8412 },
      { key: "marina-one", name: "Marina One Residences", dev: "guocoland", city: "Singapore", region: "Core Central Region", community: "Marina Bay", assetClass: "Condominium", status: "ready", handover: "TOP 2017", ppsf: 2_600, priceMin: 1_400_000, priceMax: 9_000_000, units: 1_042, yieldPct: 3.3, lat: 1.2766, lng: 103.8526 },
      { key: "boulevard-88", name: "Boulevard 88", dev: "cdl", city: "Singapore", region: "Core Central Region", community: "Orchard", assetClass: "Condominium", status: "ready", handover: "TOP 2022", ppsf: 3_400, priceMin: 3_500_000, priceMax: 14_000_000, units: 154, yieldPct: 2.7, lat: 1.3039, lng: 103.8318 },
      { key: "midtown-bay", name: "Midtown Bay", dev: "guocoland", city: "Singapore", region: "Rest of Central Region", community: "Beach Road", assetClass: "Condominium", status: "ready", handover: "TOP 2023", ppsf: 2_700, priceMin: 1_200_000, priceMax: 4_200_000, units: 219, yieldPct: 3.4, lat: 1.2995, lng: 103.8594 },
      { key: "holland-residences", name: "Holland Residences", dev: "far-east", city: "Singapore", region: "Core Central Region", community: "Holland Road", assetClass: "Condominium", status: "under_construction", handover: "TOP 2027", ppsf: 2_450, priceMin: 1_900_000, priceMax: 6_300_000, units: 320, yieldPct: 3.0, lat: 1.3112, lng: 103.7965 },
      { key: "sentosa-cove", name: "Sentosa Cove Bungalows", dev: "far-east", city: "Singapore", region: "Rest of Central Region", community: "Sentosa Cove", assetClass: "House", status: "ready", handover: "Completed 2015", ppsf: 2_000, priceMin: 12_000_000, priceMax: 36_000_000, units: 40, yieldPct: 2.2, lat: 1.2466, lng: 103.8457 },
    ],
    communities: [
      { city: "Singapore", community: "Orchard", ppsf: 3_000, rentYieldPct: 3.0, types: [{ type: "Condominium", beds: [1, 4], sqft: [500, 2_400] }] },
      { city: "Singapore", community: "Marina Bay", ppsf: 2_650, rentYieldPct: 3.3, types: [{ type: "Condominium", beds: [1, 4], sqft: [550, 2_200] }] },
      { city: "Singapore", community: "Holland Road", ppsf: 2_400, rentYieldPct: 3.1, types: [{ type: "Condominium", beds: [2, 4], sqft: [800, 2_000] }] },
      { city: "Singapore", community: "Sentosa Cove", ppsf: 2_000, rentYieldPct: 2.4, types: [{ type: "House", beds: [4, 6], sqft: [4_500, 8_000] }, { type: "Condominium", beds: [2, 4], sqft: [1_200, 2_600] }] },
    ],
    regions: ["Core Central Region", "Rest of Central Region"],
    first: ["Jia Hui", "Arjun", "Chloe", "Marcus", "Priyanka", "Ethan", "Siti", "Lucas", "Hannah", "Benjamin", "Wei Ming", "Nadia", "Ryan", "Mei Ling", "Jonathan", "Aisha", "Kenneth", "Rachel", "Darren", "Vanessa"],
    last: ["Tan", "Nair", "Ng", "Lee", "Sharma", "Goh", "Aminah", "Wong", "Koh", "Teo", "Lim", "Rahman", "Chua", "Ong", "Seah", "Kwok"],
    agents: [
      { key: "agent-1", name: "Lim Wei Jie", title: "Associate Division Director" },
      { key: "agent-2", name: "Nadia Rahman", title: "Senior Marketing Director" },
      { key: "agent-3", name: "Darren Ong", title: "Marketing Director" },
    ],
    clients: [
      { key: "c1", name: "Tan Boon Huat", type: "UHNWI", nationality: "Singapore", residency: "Singapore", domicile: "Singapore", aum: 42_000_000, risk: "Conservative" },
      { key: "c2", name: "Priya Raman", type: "HNWI", nationality: "India", residency: "Singapore", domicile: "India", aum: 5_400_000, risk: "Balanced" },
      { key: "c3", name: "Lion Peak Family Office", type: "Family Office", nationality: "Singapore", residency: "Singapore", domicile: "Singapore", aum: 150_000_000, risk: "Balanced" },
      { key: "c4", name: "Oliver Brandt", type: "HNWI", nationality: "Germany", residency: "Singapore", domicile: "Germany", aum: 6_100_000, risk: "Growth" },
      { key: "c5", name: "Grace Lau", type: "HNWI", nationality: "Hong Kong", residency: "Hong Kong", domicile: "Hong Kong", aum: 8_800_000, risk: "Growth" },
    ],
    phone: (i) => `+659${pad(1_000_000 + i * 731_313, 7).slice(0, 7)}`,
    permit: (i) => `R0${pad(61_200 + i * 113, 5)}${"ABCDE"[i % 5]}`,
    registration: (i) => `URA caveat ${pad(2026_0000 + i * 41, 8)}`,
    rentPeriod: "monthly",
    counterparty: ["Private vendor (Permanent Resident)", "CDL sales gallery", "Koh family", "Estate of Tan Ah Kow"],
  },
  AU: {
    code: "AU",
    currency: "AUD",
    aedPer: 2.42,
    developers: [
      { key: "mirvac", name: "Mirvac", hq: "Sydney", founded: 1972, listed: true, deliveryPct: 92, financialHealth: 84, summary: "ASX-listed developer of apartments and masterplanned communities in Sydney and Melbourne." },
      { key: "lendlease", name: "Lendlease", hq: "Sydney", founded: 1958, listed: true, deliveryPct: 88, financialHealth: 72, summary: "ASX-listed developer behind Barangaroo and Melbourne Quarter." },
      { key: "crown", name: "Crown Group", hq: "Sydney", founded: 1995, listed: false, deliveryPct: 86, financialHealth: 74, summary: "Private residential developer of design-led apartment towers in Sydney." },
    ],
    projects: [
      { key: "one-barangaroo", name: "One Barangaroo Residences", dev: "lendlease", city: "Sydney", region: "Sydney", community: "Barangaroo", assetClass: "Apartment", status: "ready", handover: "Completed 2021", ppsf: 3_400, priceMin: 3_500_000, priceMax: 30_000_000, units: 82, yieldPct: 2.6, lat: -33.8614, lng: 151.2014 },
      { key: "harbourside", name: "Mirvac Harbourside", dev: "mirvac", city: "Sydney", region: "Sydney", community: "Darling Harbour", assetClass: "Apartment", status: "under_construction", handover: "Q4 2026", ppsf: 2_900, priceMin: 2_200_000, priceMax: 14_000_000, units: 263, yieldPct: 3.0, lat: -33.8699, lng: 151.199 },
      { key: "bondi-residences", name: "Bondi Pavilion Residences", dev: "crown", city: "Sydney", region: "Sydney", community: "Bondi", assetClass: "Apartment", status: "ready", handover: "Completed 2023", ppsf: 2_300, priceMin: 1_600_000, priceMax: 6_500_000, units: 64, yieldPct: 3.2, lat: -33.8915, lng: 151.2767 },
      { key: "melbourne-quarter", name: "Melbourne Quarter East", dev: "lendlease", city: "Melbourne", region: "Melbourne", community: "Docklands", assetClass: "Apartment", status: "ready", handover: "Completed 2022", ppsf: 1_200, priceMin: 650_000, priceMax: 2_800_000, units: 420, yieldPct: 4.4, lat: -37.8235, lng: 144.9515 },
      { key: "toorak-park", name: "Toorak Park Residences", dev: "mirvac", city: "Melbourne", region: "Melbourne", community: "Toorak", assetClass: "Townhouse", status: "off_plan", handover: "Q2 2028", ppsf: 1_900, priceMin: 3_200_000, priceMax: 8_500_000, units: 36, yieldPct: 2.8, lat: -37.8418, lng: 145.0136 },
      { key: "southbank-tower", name: "Southbank Tower", dev: "crown", city: "Melbourne", region: "Melbourne", community: "Southbank", assetClass: "Apartment", status: "ready", handover: "Completed 2020", ppsf: 1_100, priceMin: 600_000, priceMax: 3_500_000, units: 610, yieldPct: 4.6, lat: -37.8257, lng: 144.9637 },
    ],
    communities: [
      { city: "Sydney", community: "Barangaroo", ppsf: 3_200, rentYieldPct: 2.6, types: [{ type: "Apartment", beds: [1, 4], sqft: [600, 3_000] }] },
      { city: "Sydney", community: "Bondi", ppsf: 2_300, rentYieldPct: 3.2, types: [{ type: "Apartment", beds: [1, 3], sqft: [550, 1_500] }, { type: "House", beds: [3, 5], sqft: [1_800, 3_400] }] },
      { city: "Sydney", community: "Mosman", ppsf: 2_100, rentYieldPct: 2.9, types: [{ type: "House", beds: [4, 5], sqft: [2_600, 4_800] }] },
      { city: "Melbourne", community: "Toorak", ppsf: 1_850, rentYieldPct: 2.8, types: [{ type: "House", beds: [4, 6], sqft: [3_000, 6_000] }, { type: "Townhouse", beds: [3, 4], sqft: [1_800, 2_800] }] },
      { city: "Melbourne", community: "Southbank", ppsf: 1_100, rentYieldPct: 4.6, types: [{ type: "Apartment", beds: [1, 3], sqft: [500, 1_400] }] },
    ],
    regions: ["Sydney", "Melbourne"],
    first: ["Liam", "Olivia", "Noah", "Charlotte", "Jack", "Amelia", "William", "Mia", "Lachlan", "Isla", "Thomas", "Ava", "Cooper", "Zoe", "Hamish", "Ruby", "Kai", "Matilda", "Aarav", "Sienna"],
    last: ["Smith", "Nguyen", "Williams", "Brown", "Wilson", "Taylor", "Kelly", "Papadopoulos", "Chen", "Murphy", "Walker", "Patel", "O'Brien", "Rossi", "Campbell", "Singh"],
    agents: [
      { key: "agent-1", name: "Lachlan Murphy", title: "Principal" },
      { key: "agent-2", name: "Sienna Rossi", title: "Sales Agent" },
      { key: "agent-3", name: "Kai Nguyen", title: "Property Manager" },
    ],
    clients: [
      { key: "c1", name: "Margaret Ellison", type: "UHNWI", nationality: "Australia", residency: "Australia", domicile: "Australia", aum: 26_000_000, risk: "Conservative" },
      { key: "c2", name: "Wei Zhang", type: "HNWI", nationality: "China", residency: "Australia", domicile: "China", aum: 6_800_000, risk: "Growth" },
      { key: "c3", name: "Harbour Bridge Family Office", type: "Family Office", nationality: "Australia", residency: "Australia", domicile: "Australia", aum: 80_000_000, risk: "Balanced" },
      { key: "c4", name: "Rahul Kapoor", type: "HNWI", nationality: "India", residency: "Australia", domicile: "India", aum: 3_900_000, risk: "Balanced" },
      { key: "c5", name: "Fiona MacLeod", type: "HNWI", nationality: "United Kingdom", residency: "Australia", domicile: "United Kingdom", aum: 4_600_000, risk: "Growth" },
    ],
    phone: (i) => `+614${pad(10_000_000 + i * 6_131_313, 8).slice(0, 8)}`,
    permit: () => null,
    registration: (i) => `Folio ${100 + i}/SP${pad(91_000 + i * 17, 5)}`,
    rentPeriod: "monthly",
    counterparty: ["Private vendor (downsizing)", "Mirvac sales suite", "Kelly family trust", "Executors of the Walker estate"],
  },
  US: {
    code: "US",
    currency: "USD",
    aedPer: 3.6725,
    developers: [
      { key: "related", name: "Related Companies", hq: "New York", founded: 1972, listed: false, deliveryPct: 92, financialHealth: 85, summary: "Private developer of Hudson Yards and luxury towers in Manhattan and Miami." },
      { key: "extell", name: "Extell Development", hq: "New York", founded: 1989, listed: false, deliveryPct: 88, financialHealth: 76, summary: "Manhattan developer of Billionaires' Row condominiums." },
      { key: "fortune", name: "Fortune International", hq: "Miami", founded: 1983, listed: false, deliveryPct: 89, financialHealth: 78, summary: "Miami developer of branded oceanfront residences." },
    ],
    projects: [
      { key: "hudson-yards", name: "35 Hudson Yards", dev: "related", city: "New York", region: "Manhattan", community: "Hudson Yards", assetClass: "Condominium", status: "ready", handover: "Completed 2019", ppsf: 2_900, priceMin: 4_000_000, priceMax: 32_000_000, units: 143, yieldPct: 2.8, lat: 40.7546, lng: -74.0019 },
      { key: "central-park-tower", name: "Central Park Tower", dev: "extell", city: "New York", region: "Manhattan", community: "Midtown", assetClass: "Condominium", status: "ready", handover: "Completed 2020", ppsf: 4_200, priceMin: 7_000_000, priceMax: 60_000_000, units: 179, yieldPct: 2.2, lat: 40.7663, lng: -73.981 },
      { key: "tribeca-lofts", name: "Tribeca Lofts", dev: "extell", city: "New York", region: "Manhattan", community: "Tribeca", assetClass: "Condominium", status: "under_construction", handover: "Q2 2027", ppsf: 2_600, priceMin: 2_800_000, priceMax: 14_000_000, units: 62, yieldPct: 2.9, lat: 40.7195, lng: -74.0089 },
      { key: "brickell-flatiron", name: "Brickell Flatiron", dev: "fortune", city: "Miami", region: "Miami", community: "Brickell", assetClass: "Condominium", status: "ready", handover: "Completed 2019", ppsf: 900, priceMin: 650_000, priceMax: 4_500_000, units: 527, yieldPct: 5.0, lat: 25.7656, lng: -80.1918 },
      { key: "miami-beach-edition", name: "Ocean Residences, Miami Beach", dev: "fortune", city: "Miami", region: "Miami", community: "Miami Beach", assetClass: "Condominium", status: "off_plan", handover: "Q4 2028", ppsf: 2_100, priceMin: 3_000_000, priceMax: 25_000_000, units: 68, yieldPct: 3.4, lat: 25.8017, lng: -80.1283 },
      { key: "coconut-grove", name: "Park Grove, Coconut Grove", dev: "related", city: "Miami", region: "Miami", community: "Coconut Grove", assetClass: "Condominium", status: "ready", handover: "Completed 2018", ppsf: 1_300, priceMin: 1_500_000, priceMax: 9_000_000, units: 276, yieldPct: 4.1, lat: 25.7268, lng: -80.2365 },
    ],
    communities: [
      { city: "New York", community: "Upper East Side", ppsf: 1_850, rentYieldPct: 3.0, types: [{ type: "Condominium", beds: [1, 4], sqft: [700, 3_000] }] },
      { city: "New York", community: "Tribeca", ppsf: 2_500, rentYieldPct: 2.9, types: [{ type: "Condominium", beds: [2, 4], sqft: [1_200, 3_500] }] },
      { city: "New York", community: "Hudson Yards", ppsf: 2_800, rentYieldPct: 2.8, types: [{ type: "Condominium", beds: [1, 4], sqft: [800, 3_200] }] },
      { city: "Miami", community: "Brickell", ppsf: 900, rentYieldPct: 5.0, types: [{ type: "Condominium", beds: [1, 3], sqft: [650, 1_800] }] },
      { city: "Miami", community: "Miami Beach", ppsf: 1_600, rentYieldPct: 3.8, types: [{ type: "Condominium", beds: [1, 4], sqft: [800, 3_200] }, { type: "House", beds: [4, 6], sqft: [3_500, 7_000] }] },
    ],
    regions: ["Manhattan", "Miami"],
    first: ["Emily", "Michael", "Sophia", "Daniel", "Olivia", "Matthew", "Isabella", "Andrew", "Mia", "Jacob", "Ava", "Ethan", "Grace", "Lucas", "Chloe", "Nathan", "Sofia", "Benjamin", "Aaliyah", "Carlos"],
    last: ["Johnson", "Rodriguez", "Kim", "Goldberg", "Martinez", "Patel", "Thompson", "Rivera", "Chen", "Sullivan", "Lopez", "Feldman", "Brooks", "Nguyen", "Garcia", "Weiss"],
    agents: [
      { key: "agent-1", name: "Rachel Goldberg", title: "Licensed Associate Broker" },
      { key: "agent-2", name: "Carlos Rivera", title: "Licensed Salesperson" },
      { key: "agent-3", name: "Nathan Brooks", title: "Licensed Salesperson" },
    ],
    clients: [
      { key: "c1", name: "Jonathan Whitmore", type: "UHNWI", nationality: "United States", residency: "United States", domicile: "United States", aum: 55_000_000, risk: "Balanced" },
      { key: "c2", name: "Valentina Ruiz", type: "HNWI", nationality: "Mexico", residency: "United States", domicile: "Mexico", aum: 7_400_000, risk: "Growth" },
      { key: "c3", name: "Hudson Ridge Family Office", type: "Family Office", nationality: "United States", residency: "United States", domicile: "United States", aum: 210_000_000, risk: "Conservative" },
      { key: "c4", name: "Aditya Varma", type: "HNWI", nationality: "India", residency: "United States", domicile: "India", aum: 6_300_000, risk: "Balanced" },
      { key: "c5", name: "Claire Dubois", type: "HNWI", nationality: "France", residency: "France", domicile: "France", aum: 9_100_000, risk: "Growth" },
    ],
    phone: (i) => `+1212${pad(5_550_000 + i * 731, 7).slice(0, 7)}`,
    permit: () => null,
    registration: (i) => `ACRIS ${pad(2026_000_000 + i * 977, 10)}`,
    rentPeriod: "monthly",
    counterparty: ["Private seller (relocating)", "Related Companies sales gallery", "Sullivan family trust", "Estate of M. Feldman"],
  },
};

/** The advisory catalogue's name for each market (developers, projects, client policies). */
export const CATALOGUE_NAME: Record<MarketCode, CatalogueMarket> = { AE: "UAE", IN: "India", GB: "United Kingdom", SG: "Singapore", AU: "Australia", US: "United States" };

/** Trial and demonstration countries: the six markets; anything else seeds the UAE profile. */
export const profileFor = (code: string | null | undefined): MarketProfile => PROFILES[(code ?? "AE") as MarketCode] ?? PROFILES.AE;
