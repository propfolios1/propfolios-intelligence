/**
 * Seed catalogue. Names of developers and projects are real; prices, RERA
 * numbers, coordinates, unit counts and every performance figure are
 * synthetic and exist only to demonstrate the product.
 */

export const INR_PER_AED = 22.6;
export const USD_PER_AED = 1 / 3.6725;

export type DeveloperSeed = {
  key: string;
  name: string;
  market: "UAE" | "India";
  hq: string;
  founded: number;
  listed: string | null;
  deliveryPct: number;
  financialHealth: number;
  litigationCount: number;
  sentimentScore: number;
  projectsDelivered: number;
  unitsDelivered: number;
  escrowCompliant: boolean;
  summary: string;
};

export const DEVELOPERS: DeveloperSeed[] = [
  { key: "emaar", name: "Emaar Properties", market: "UAE", hq: "Dubai", founded: 1997, listed: "DFM: EMAAR", deliveryPct: 96, financialHealth: 92, litigationCount: 3, sentimentScore: 84, projectsDelivered: 118, unitsDelivered: 108_400, escrowCompliant: true, summary: "Dubai's largest master developer. Investment-grade balance sheet, consistent on-time delivery across Downtown, Dubai Hills and Arabian Ranches, and the deepest secondary market liquidity in the emirate." },
  { key: "damac", name: "DAMAC Properties", market: "UAE", hq: "Dubai", founded: 2002, listed: "Private (delisted 2022)", deliveryPct: 79, financialHealth: 71, litigationCount: 12, sentimentScore: 62, projectsDelivered: 64, unitsDelivered: 44_800, escrowCompliant: true, summary: "High-volume luxury developer known for branded residences. Strong sales velocity; historic handover slippage and a heavier litigation book than tier-one peers." },
  { key: "aldar", name: "Aldar Properties", market: "UAE", hq: "Abu Dhabi", founded: 2004, listed: "ADX: ALDAR", deliveryPct: 97, financialHealth: 90, litigationCount: 2, sentimentScore: 82, projectsDelivered: 86, unitsDelivered: 51_200, escrowCompliant: true, summary: "Abu Dhabi's dominant developer and master planner of Saadiyat and Yas. Government-related shareholder base, conservative leverage and a recurring-income portfolio that cushions development risk." },
  { key: "nakheel", name: "Nakheel", market: "UAE", hq: "Dubai", founded: 2000, listed: "Dubai Holding subsidiary", deliveryPct: 83, financialHealth: 78, litigationCount: 7, sentimentScore: 70, projectsDelivered: 58, unitsDelivered: 39_600, escrowCompliant: true, summary: "Master developer of Palm Jumeirah and JVC. Balance sheet restored after the 2009 restructuring and the 2023 consolidation into Dubai Holding." },
  { key: "sobha", name: "Sobha Realty", market: "UAE", hq: "Dubai", founded: 1976, listed: null, deliveryPct: 91, financialHealth: 81, litigationCount: 3, sentimentScore: 77, projectsDelivered: 44, unitsDelivered: 18_900, escrowCompliant: true, summary: "Vertically integrated developer with in-house construction. Build quality is a recognised differentiator in MBR City; delivery record is strong with occasional phase-level delays." },
  { key: "danube", name: "Danube Properties", market: "UAE", hq: "Dubai", founded: 2014, listed: null, deliveryPct: 86, financialHealth: 69, litigationCount: 5, sentimentScore: 66, projectsDelivered: 23, unitsDelivered: 11_300, escrowCompliant: true, summary: "Mid-market developer popularising 1% monthly payment plans. Fast growing; plan structure concentrates buyer risk late in the cycle." },
  { key: "binghatti", name: "Binghatti Developers", market: "UAE", hq: "Dubai", founded: 2008, listed: null, deliveryPct: 77, financialHealth: 64, litigationCount: 6, sentimentScore: 61, projectsDelivered: 29, unitsDelivered: 9_700, escrowCompliant: true, summary: "Design-led developer concentrated in JVC and Business Bay. Rapid pipeline expansion since 2022 has outpaced its historic delivery capacity." },
  { key: "ellington", name: "Ellington Properties", market: "UAE", hq: "Dubai", founded: 2014, listed: null, deliveryPct: 90, financialHealth: 76, litigationCount: 1, sentimentScore: 78, projectsDelivered: 19, unitsDelivered: 4_100, escrowCompliant: true, summary: "Boutique design-focused developer. Smaller scale, high resale premiums and a clean delivery record across Dubai Hills, JVC and Downtown." },
  { key: "lodha", name: "Lodha Group (Macrotech)", market: "India", hq: "Mumbai", founded: 1980, listed: "NSE: LODHA", deliveryPct: 84, financialHealth: 74, litigationCount: 14, sentimentScore: 68, projectsDelivered: 104, unitsDelivered: 91_000, escrowCompliant: true, summary: "Mumbai Metropolitan Region's largest residential developer by volume. Deleveraged materially since its 2021 listing." },
  { key: "rustomjee", name: "Rustomjee Group", market: "India", hq: "Mumbai", founded: 1996, listed: "NSE: KEYSTONE", deliveryPct: 82, financialHealth: 70, litigationCount: 6, sentimentScore: 67, projectsDelivered: 77, unitsDelivered: 18_600, escrowCompliant: true, summary: "Mumbai redevelopment specialist with a strong western-suburbs franchise. Listed in 2022." },
  { key: "oberoi", name: "Oberoi Realty", market: "India", hq: "Mumbai", founded: 1980, listed: "NSE: OBEROIRLTY", deliveryPct: 93, financialHealth: 91, litigationCount: 3, sentimentScore: 81, projectsDelivered: 46, unitsDelivered: 12_900, escrowCompliant: true, summary: "Premium Mumbai developer with near-zero net debt and an annuity portfolio of malls and hotels." },
  { key: "prestige", name: "Prestige Group", market: "India", hq: "Bengaluru", founded: 1986, listed: "NSE: PRESTIGE", deliveryPct: 88, financialHealth: 77, litigationCount: 8, sentimentScore: 73, projectsDelivered: 296, unitsDelivered: 81_000, escrowCompliant: true, summary: "South India's largest diversified developer. Strong Bengaluru residential franchise and a growing commercial annuity book." },
  { key: "sobha-india", name: "Sobha Limited", market: "India", hq: "Bengaluru", founded: 1995, listed: "NSE: SOBHA", deliveryPct: 90, financialHealth: 75, litigationCount: 5, sentimentScore: 74, projectsDelivered: 158, unitsDelivered: 47_000, escrowCompliant: true, summary: "Backward-integrated Bengaluru developer, sister entity of Sobha Realty in Dubai. Quality reputation, moderate leverage." },
  { key: "brigade", name: "Brigade Group", market: "India", hq: "Bengaluru", founded: 1986, listed: "NSE: BRIGADE", deliveryPct: 87, financialHealth: 76, litigationCount: 6, sentimentScore: 72, projectsDelivered: 280, unitsDelivered: 39_000, escrowCompliant: true, summary: "Bengaluru developer with balanced residential, office and hospitality exposure." },
  { key: "dlf", name: "DLF Limited", market: "India", hq: "Gurugram", founded: 1946, listed: "NSE: DLF", deliveryPct: 86, financialHealth: 85, litigationCount: 19, sentimentScore: 71, projectsDelivered: 158, unitsDelivered: 62_000, escrowCompliant: true, summary: "India's largest listed developer by market capitalisation. Dominant in Gurugram luxury; legacy litigation from earlier cycles remains on the docket." },
  { key: "godrej", name: "Godrej Properties", market: "India", hq: "Mumbai", founded: 1990, listed: "NSE: GODREJPROP", deliveryPct: 89, financialHealth: 80, litigationCount: 9, sentimentScore: 79, projectsDelivered: 112, unitsDelivered: 58_000, escrowCompliant: true, summary: "Pan-India developer backed by the Godrej group. Asset-light joint development model and strong brand trust." },
  { key: "m3m", name: "M3M India", market: "India", hq: "Gurugram", founded: 2010, listed: null, deliveryPct: 74, financialHealth: 62, litigationCount: 16, sentimentScore: 58, projectsDelivered: 34, unitsDelivered: 21_000, escrowCompliant: true, summary: "Gurugram developer with an aggressive luxury and mixed-use pipeline. Promoter-level regulatory scrutiny in 2023 weighs on sentiment." },
  { key: "kolte", name: "Kolte-Patil Developers", market: "India", hq: "Pune", founded: 1991, listed: "NSE: KOLTEPATIL", deliveryPct: 85, financialHealth: 68, litigationCount: 4, sentimentScore: 69, projectsDelivered: 62, unitsDelivered: 27_000, escrowCompliant: true, summary: "Pune's leading mid-market developer and master planner of the Life Republic township in Hinjewadi." },
  { key: "hiranandani", name: "Hiranandani Group", market: "India", hq: "Mumbai", founded: 1978, listed: null, deliveryPct: 83, financialHealth: 72, litigationCount: 11, sentimentScore: 70, projectsDelivered: 88, unitsDelivered: 46_000, escrowCompliant: true, summary: "Builder of Powai's Hiranandani Gardens and Thane's Hiranandani Estate. Recognisable township brand; a 2020 promoter family dispute and MahaRERA delay complaints on older phases weigh on the litigation score." },
  { key: "sun-estates", name: "Sun Estates Developers", market: "India", hq: "Panaji", founded: 1994, listed: null, deliveryPct: 86, financialHealth: 66, litigationCount: 3, sentimentScore: 71, projectsDelivered: 31, unitsDelivered: 1_150, escrowCompliant: true, summary: "Goan developer of Portuguese-style villa communities in Bardez. Small balance sheet, consistent delivery, two Goa RERA complaints on carpet area." },
  { key: "acron", name: "Acron Developers", market: "India", hq: "Porvorim", founded: 1996, listed: null, deliveryPct: 81, financialHealth: 63, litigationCount: 5, sentimentScore: 68, projectsDelivered: 27, unitsDelivered: 2_400, escrowCompliant: true, summary: "North Goa developer of serviced apartments and villas in Porvorim and Siolim. Rental pool programmes support yields; one project delayed by a CRZ review." },
  { key: "veera", name: "Veera Group", market: "India", hq: "Mumbai", founded: 1982, listed: null, deliveryPct: 79, financialHealth: 61, litigationCount: 6, sentimentScore: 64, projectsDelivered: 22, unitsDelivered: 1_900, escrowCompliant: true, summary: "Mumbai-based developer with a Goa holiday-home franchise at Candolim and Vagator. Title on one parcel derives from a Comunidade aforamento." },
  { key: "empire", name: "Empire Realty Goa", market: "India", hq: "Margao", founded: 2004, listed: null, deliveryPct: 72, financialHealth: 55, litigationCount: 8, sentimentScore: 57, projectsDelivered: 14, unitsDelivered: 760, escrowCompliant: false, summary: "South Goa mid-market developer. Repeated Goa RERA delay orders and a pending mundkar claim on its Benaulim land; escrow deposits were found short in a 2025 audit." },
];

/** Weighted risk model: higher is riskier, 0–100. Mirrors the developer-risk agent's scoring rubric. */
export function scoreDeveloper(d: Pick<DeveloperSeed, "deliveryPct" | "financialHealth" | "litigationCount" | "sentimentScore" | "escrowCompliant">) {
  const breakdown = {
    delivery: Math.min(100, +((100 - d.deliveryPct) * 2).toFixed(1)),
    financial: +(100 - d.financialHealth).toFixed(1),
    litigation: Math.min(100, d.litigationCount * 5),
    sentiment: +(100 - d.sentimentScore).toFixed(1),
    escrow: d.escrowCompliant ? 0 : 100,
  };
  const score = breakdown.delivery * 0.35 + breakdown.financial * 0.25 + breakdown.litigation * 0.15 + breakdown.sentiment * 0.15 + breakdown.escrow * 0.1;
  return { breakdown, riskScore: +score.toFixed(1) };
}

export type PropertySeed = {
  slug: string;
  name: string;
  developer: string;
  market: "UAE" | "India";
  city: string;
  region: string;
  community: string;
  assetClass: string;
  status: "off_plan" | "under_construction" | "ready";
  handover: string;
  currency: "AED" | "INR";
  priceMin: number;
  priceMax: number;
  pricePerSqft: number;
  units: number;
  grossYield: number;
  rera: string;
  lat: number;
  lng: number;
  paymentPlan: string | null;
  description: string;
};

const cr = (x: number) => Math.round(x * 10_000_000);

export const PROPERTIES: PropertySeed[] = [
  { slug: "burj-crown", name: "Burj Crown", developer: "emaar", market: "UAE", city: "Dubai", region: "Dubai", community: "Downtown Dubai", assetClass: "Residential", status: "ready", handover: "Completed Q2 2023", currency: "AED", priceMin: 1_800_000, priceMax: 4_200_000, pricePerSqft: 2_880, units: 412, grossYield: 6.1, rera: "DLD Project 2015", lat: 25.195, lng: 55.2766, paymentPlan: null, description: "Forty-two-storey tower on the Downtown boulevard with direct Burj Khalifa views. One to three bedrooms, completed in 2023 with a stable owner-occupier and corporate-let mix." },
  { slug: "downtown-views", name: "Downtown Views", developer: "emaar", market: "UAE", city: "Dubai", region: "Dubai", community: "Downtown Dubai", assetClass: "Residential", status: "ready", handover: "Completed Q4 2021", currency: "AED", priceMin: 2_100_000, priceMax: 5_500_000, pricePerSqft: 2_720, units: 586, grossYield: 6.3, rera: "DLD Project 1418", lat: 25.1924, lng: 55.281, paymentPlan: null, description: "Twin-tower residence connected to Dubai Mall, with fountain and Burj Khalifa outlooks. Mature rental history and deep resale liquidity." },
  { slug: "marina-shores", name: "Marina Shores", developer: "emaar", market: "UAE", city: "Dubai", region: "Dubai", community: "Dubai Marina", assetClass: "Residential", status: "under_construction", handover: "Q4 2026", currency: "AED", priceMin: 2_400_000, priceMax: 6_800_000, pricePerSqft: 3_150, units: 540, grossYield: 6.0, rera: "DLD Project 3184", lat: 25.0788, lng: 55.1349, paymentPlan: "10% booking, 50% during construction, 40% on handover", description: "Waterfront tower at the Marina's western edge with direct beach access via Dubai Harbour. Structure topped out; facade works under way." },
  { slug: "arabian-ranches-iii", name: "Arabian Ranches III", developer: "emaar", market: "UAE", city: "Dubai", region: "Dubai", community: "Arabian Ranches", assetClass: "Villa", status: "ready", handover: "Completed Q1 2024", currency: "AED", priceMin: 3_200_000, priceMax: 8_000_000, pricePerSqft: 1_620, units: 1_840, grossYield: 5.2, rera: "DLD Project 2640", lat: 25.0393, lng: 55.2869, paymentPlan: null, description: "Third phase of the Ranches family community. Three to five bedroom villas and townhouses favoured by end-user families." },
  { slug: "cavalli-tower", name: "Cavalli Tower", developer: "damac", market: "UAE", city: "Dubai", region: "Dubai", community: "Business Bay", assetClass: "Branded Residence", status: "under_construction", handover: "Q2 2027", currency: "AED", priceMin: 2_800_000, priceMax: 12_000_000, pricePerSqft: 3_620, units: 486, grossYield: 5.4, rera: "DLD Project 3021", lat: 25.1856, lng: 55.262, paymentPlan: "20% booking, 50% during construction, 30% on handover", description: "Roberto Cavalli-branded tower with fully furnished residences. Positioned at the top of the Business Bay pricing range." },
  { slug: "safa-one", name: "Safa One", developer: "damac", market: "UAE", city: "Dubai", region: "Dubai", community: "Al Safa", assetClass: "Branded Residence", status: "under_construction", handover: "Q4 2026", currency: "AED", priceMin: 4_500_000, priceMax: 18_000_000, pricePerSqft: 3_380, units: 450, grossYield: 5.1, rera: "DLD Project 2789", lat: 25.181, lng: 55.247, paymentPlan: "20% booking, 50% during construction, 30% on handover", description: "De GRISOGONO-branded tower beside Safa Park with Sheikh Zayed Road frontage. Distinctive cascading-garden facade." },
  { slug: "business-bay-heights", name: "Business Bay Heights", developer: "damac", market: "UAE", city: "Dubai", region: "Dubai", community: "Business Bay", assetClass: "Residential", status: "ready", handover: "Completed Q3 2022", currency: "AED", priceMin: 1_400_000, priceMax: 3_200_000, pricePerSqft: 1_980, units: 620, grossYield: 7.1, rera: "DLD Project 1730", lat: 25.188, lng: 55.27, paymentPlan: null, description: "Canal-adjacent residential tower with hotel-style amenities. High rental demand from Business Bay office tenants." },
  { slug: "saadiyat-reserve", name: "Saadiyat Reserve", developer: "aldar", market: "UAE", city: "Abu Dhabi", region: "Abu Dhabi", community: "Saadiyat Island", assetClass: "Villa", status: "ready", handover: "Completed Q3 2023", currency: "AED", priceMin: 4_200_000, priceMax: 15_000_000, pricePerSqft: 1_890, units: 420, grossYield: 5.0, rera: "ADREC 2021-0417", lat: 24.532, lng: 54.445, paymentPlan: null, description: "Villa plots and completed homes beside the Saadiyat Cultural District, minutes from the Louvre and Guggenheim Abu Dhabi." },
  { slug: "yas-acres", name: "Yas Acres", developer: "aldar", market: "UAE", city: "Abu Dhabi", region: "Abu Dhabi", community: "Yas Island", assetClass: "Villa", status: "ready", handover: "Completed Q4 2021", currency: "AED", priceMin: 3_800_000, priceMax: 9_000_000, pricePerSqft: 1_340, units: 1_315, grossYield: 5.8, rera: "ADREC 2017-0233", lat: 24.488, lng: 54.617, paymentPlan: null, description: "Golf-course villa and townhouse community on Yas Island. Established family rental market." },
  { slug: "mamsha-al-saadiyat", name: "Mamsha Al Saadiyat", developer: "aldar", market: "UAE", city: "Abu Dhabi", region: "Abu Dhabi", community: "Saadiyat Island", assetClass: "Residential", status: "ready", handover: "Completed Q2 2020", currency: "AED", priceMin: 2_900_000, priceMax: 11_000_000, pricePerSqft: 2_240, units: 461, grossYield: 5.6, rera: "ADREC 2016-0118", lat: 24.544, lng: 54.434, paymentPlan: null, description: "Beachfront low-rise residences on Saadiyat's cultural district shoreline. Scarce product with limited future beachfront supply." },
  { slug: "palm-beach-towers", name: "Palm Beach Towers", developer: "nakheel", market: "UAE", city: "Dubai", region: "Dubai", community: "Palm Jumeirah", assetClass: "Residential", status: "ready", handover: "Completed Q4 2022", currency: "AED", priceMin: 3_500_000, priceMax: 14_000_000, pricePerSqft: 3_960, units: 543, grossYield: 4.6, rera: "DLD Project 1563", lat: 25.108, lng: 55.152, paymentPlan: null, description: "Three towers on the Palm trunk with a 270-metre rooftop infinity pool and private beach. Prime Palm pricing with resort-style amenities." },
  { slug: "jvc-residences", name: "JVC Residences", developer: "nakheel", market: "UAE", city: "Dubai", region: "Dubai", community: "Jumeirah Village Circle", assetClass: "Residential", status: "ready", handover: "Completed Q1 2022", currency: "AED", priceMin: 900_000, priceMax: 2_400_000, pricePerSqft: 1_320, units: 780, grossYield: 7.6, rera: "DLD Project 1677", lat: 25.058, lng: 55.208, paymentPlan: null, description: "Mid-rise apartments in JVC, Dubai's highest-volume rental submarket. Yield-led investor product." },
  { slug: "sobha-hartland", name: "Sobha Hartland", developer: "sobha", market: "UAE", city: "Dubai", region: "Dubai", community: "Mohammed Bin Rashid City", assetClass: "Residential", status: "ready", handover: "Completed Q3 2022", currency: "AED", priceMin: 2_200_000, priceMax: 7_500_000, pricePerSqft: 2_310, units: 1_240, grossYield: 6.2, rera: "DLD Project 1205", lat: 25.176, lng: 55.31, paymentPlan: null, description: "Waterfront master community on the Dubai Water Canal with international schools and Sobha's in-house build quality." },
  { slug: "sobha-creek-vistas", name: "Sobha Creek Vistas", developer: "sobha", market: "UAE", city: "Dubai", region: "Dubai", community: "Mohammed Bin Rashid City", assetClass: "Residential", status: "under_construction", handover: "Q3 2027", currency: "AED", priceMin: 1_600_000, priceMax: 4_800_000, pricePerSqft: 2_140, units: 920, grossYield: 6.4, rera: "DLD Project 3301", lat: 25.177, lng: 55.315, paymentPlan: "20% booking, 40% during construction, 40% on handover", description: "Twin towers overlooking Ras Al Khor and the Downtown skyline. Second-phase launch inside Sobha Hartland." },
  { slug: "bayz-101", name: "Bayz 101", developer: "danube", market: "UAE", city: "Dubai", region: "Dubai", community: "Business Bay", assetClass: "Residential", status: "under_construction", handover: "Q1 2027", currency: "AED", priceMin: 1_100_000, priceMax: 2_800_000, pricePerSqft: 2_050, units: 690, grossYield: 7.0, rera: "DLD Project 3240", lat: 25.187, lng: 55.258, paymentPlan: "1% monthly; 20% booking, 30% on handover", description: "One-hundred-and-one-storey residential tower with a 1% monthly payment plan. Investor-led buyer base." },
  { slug: "starz-by-danube", name: "Starz by Danube", developer: "danube", market: "UAE", city: "Dubai", region: "Dubai", community: "Al Furjan", assetClass: "Residential", status: "ready", handover: "Completed Q2 2024", currency: "AED", priceMin: 800_000, priceMax: 2_200_000, pricePerSqft: 1_410, units: 452, grossYield: 7.4, rera: "DLD Project 2468", lat: 25.027, lng: 55.15, paymentPlan: null, description: "Furnished apartments next to the Al Furjan metro station. Entry-level investor product with strong yields." },
  { slug: "binghatti-corner", name: "Binghatti Corner", developer: "binghatti", market: "UAE", city: "Dubai", region: "Dubai", community: "Jumeirah Village Circle", assetClass: "Residential", status: "under_construction", handover: "Q2 2026", currency: "AED", priceMin: 1_200_000, priceMax: 2_900_000, pricePerSqft: 1_490, units: 360, grossYield: 7.5, rera: "DLD Project 3112", lat: 25.06, lng: 55.21, paymentPlan: "20% booking, 50% during construction, 30% on handover", description: "Mid-rise JVC building with Binghatti's signature facade. Handover guided for Q2 2026, two quarters later than at launch." },
  { slug: "binghatti-heights", name: "Binghatti Heights", developer: "binghatti", market: "UAE", city: "Dubai", region: "Dubai", community: "Jumeirah Village Circle", assetClass: "Residential", status: "ready", handover: "Completed Q4 2023", currency: "AED", priceMin: 1_400_000, priceMax: 3_400_000, pricePerSqft: 1_560, units: 410, grossYield: 7.2, rera: "DLD Project 2213", lat: 25.062, lng: 55.205, paymentPlan: null, description: "Completed JVC residential building with a stable short- and long-let rental base." },
  { slug: "ellington-house", name: "Ellington House", developer: "ellington", market: "UAE", city: "Dubai", region: "Dubai", community: "Dubai Hills Estate", assetClass: "Residential", status: "under_construction", handover: "Q1 2027", currency: "AED", priceMin: 2_600_000, priceMax: 6_200_000, pricePerSqft: 2_380, units: 280, grossYield: 5.9, rera: "DLD Project 3168", lat: 25.11, lng: 55.245, paymentPlan: "20% booking, 50% during construction, 30% on handover", description: "Boutique residence facing Dubai Hills Park. Low unit count and Ellington's interior specification support resale premiums." },
  { slug: "belgravia-heights", name: "Belgravia Heights", developer: "ellington", market: "UAE", city: "Dubai", region: "Dubai", community: "Jumeirah Village Circle", assetClass: "Residential", status: "ready", handover: "Completed Q3 2023", currency: "AED", priceMin: 1_300_000, priceMax: 3_100_000, pricePerSqft: 1_640, units: 238, grossYield: 7.0, rera: "DLD Project 2104", lat: 25.056, lng: 55.203, paymentPlan: null, description: "Design-led JVC residence with a resort deck. Commands a premium to the JVC median per square foot." },
  { slug: "lodha-amara", name: "Lodha Amara", developer: "lodha", market: "India", city: "Thane", region: "Maharashtra", community: "Kolshet Road, Thane", assetClass: "Residential", status: "ready", handover: "Completed 2023", currency: "INR", priceMin: cr(1.2), priceMax: cr(2.8), pricePerSqft: 16_800, units: 3_200, grossYield: 3.1, rera: "MahaRERA P51700012345", lat: 19.224, lng: 72.978, paymentPlan: null, description: "Large-format township on Thane's Kolshet Road with schools and retail inside the gate. Liquid resale market." },
  { slug: "rustomjee-elements", name: "Rustomjee Elements", developer: "rustomjee", market: "India", city: "Mumbai", region: "Maharashtra", community: "Andheri West", assetClass: "Residential", status: "ready", handover: "Completed 2022", currency: "INR", priceMin: cr(2.4), priceMax: cr(5.5), pricePerSqft: 34_500, units: 620, grossYield: 2.9, rera: "MahaRERA P51800009876", lat: 19.124, lng: 72.834, paymentPlan: null, description: "Premium Andheri West residences near the Juhu micro-market. Strong owner-occupier demand." },
  { slug: "oberoi-sky-city", name: "Oberoi Sky City", developer: "oberoi", market: "India", city: "Mumbai", region: "Maharashtra", community: "Borivali East", assetClass: "Residential", status: "ready", handover: "Completed 2024", currency: "INR", priceMin: cr(1.8), priceMax: cr(4.2), pricePerSqft: 29_800, units: 2_100, grossYield: 3.0, rera: "MahaRERA P51800004521", lat: 19.23, lng: 72.86, paymentPlan: null, description: "High-rise complex on the Western Express Highway with a dedicated mall, delivered by Mumbai's lowest-leverage listed developer." },
  { slug: "prestige-lakeside", name: "Prestige Lakeside Habitat", developer: "prestige", market: "India", city: "Bengaluru", region: "Karnataka", community: "Hebbal", assetClass: "Residential", status: "ready", handover: "Completed 2021", currency: "INR", priceMin: cr(1.4), priceMax: cr(3.2), pricePerSqft: 13_900, units: 3_400, grossYield: 3.4, rera: "PRM/KA/RERA/1251/446/PR/171015/000287", lat: 13.045, lng: 77.597, paymentPlan: null, description: "Lake-facing township in north Bengaluru, ten minutes from the Manyata tech park and the airport corridor." },
  { slug: "sobha-dream-acres", name: "Sobha Dream Acres", developer: "sobha-india", market: "India", city: "Bengaluru", region: "Karnataka", community: "Panathur", assetClass: "Residential", status: "ready", handover: "Completed 2022", currency: "INR", priceMin: cr(0.9), priceMax: cr(2.1), pricePerSqft: 10_400, units: 6_500, grossYield: 3.8, rera: "PRM/KA/RERA/1251/446/PR/180316/001498", lat: 12.937, lng: 77.702, paymentPlan: null, description: "Eighty-one-acre township on the Outer Ring Road tech corridor. Rental demand from Bellandur and Marathahalli offices." },
  { slug: "brigade-utopia", name: "Brigade Utopia", developer: "brigade", market: "India", city: "Bengaluru", region: "Karnataka", community: "Yelahanka", assetClass: "Residential", status: "under_construction", handover: "Q2 2026", currency: "INR", priceMin: cr(1.1), priceMax: cr(2.6), pricePerSqft: 11_200, units: 1_840, grossYield: 3.5, rera: "PRM/KA/RERA/1251/309/PR/210521/004102", lat: 13.1, lng: 77.596, paymentPlan: "Construction-linked, 10% booking", description: "Mid-market township on the airport road corridor with an under-construction metro extension nearby." },
  { slug: "dlf-camellias", name: "DLF The Camellias", developer: "dlf", market: "India", city: "Gurugram", region: "Haryana", community: "Golf Course Road", assetClass: "Residential", status: "ready", handover: "Completed 2019", currency: "INR", priceMin: cr(8), priceMax: cr(25), pricePerSqft: 72_000, units: 429, grossYield: 2.4, rera: "HRERA-GGM-2017-0098", lat: 28.456, lng: 77.096, paymentPlan: null, description: "India's most expensive gated residential address, set on DLF Golf and Country Club. Record per-square-foot transactions since 2023." },
  { slug: "godrej-aristocrat", name: "Godrej Aristocrat", developer: "godrej", market: "India", city: "Gurugram", region: "Haryana", community: "Sector 49", assetClass: "Residential", status: "under_construction", handover: "Q4 2027", currency: "INR", priceMin: cr(3.2), priceMax: cr(7.8), pricePerSqft: 22_500, units: 760, grossYield: 2.9, rera: "HRERA-GGM-2023-0412", lat: 28.41, lng: 77.057, paymentPlan: "Construction-linked, 10% booking", description: "Luxury low-density development off Golf Course Extension Road. Sold out within a week of launch." },
  { slug: "m3m-golfestate", name: "M3M Golfestate", developer: "m3m", market: "India", city: "Gurugram", region: "Haryana", community: "Sector 65", assetClass: "Mixed-use", status: "ready", handover: "Completed 2021", currency: "INR", priceMin: cr(2.8), priceMax: cr(6.5), pricePerSqft: 17_800, units: 1_150, grossYield: 3.6, rera: "HRERA-GGM-2017-0221", lat: 28.404, lng: 77.073, paymentPlan: null, description: "Golf-course community on Golf Course Extension Road with an integrated high-street retail and office podium." },
  { slug: "life-republic", name: "Kolte Patil Life Republic", developer: "kolte", market: "India", city: "Pune", region: "Maharashtra", community: "Hinjewadi", assetClass: "Residential", status: "under_construction", handover: "Phased, 2025–2028", currency: "INR", priceMin: cr(0.8), priceMax: cr(1.9), pricePerSqft: 7_600, units: 12_000, grossYield: 4.0, rera: "MahaRERA P52100047723", lat: 18.596, lng: 73.728, paymentPlan: "Construction-linked", description: "Four-hundred-acre integrated township next to the Hinjewadi IT park, Pune's largest employment cluster." },
  { slug: "lodha-world-one", name: "Lodha World One", developer: "lodha", market: "India", city: "Mumbai", region: "Maharashtra", community: "Worli", assetClass: "Residential", status: "ready", handover: "Completed 2020", currency: "INR", priceMin: cr(9.5), priceMax: cr(32), pricePerSqft: 68_000, units: 290, grossYield: 2.2, rera: "MahaRERA P51900000325", lat: 19.0, lng: 72.828, paymentPlan: null, description: "Super-tall residential tower on Senapati Bapat Marg overlooking the Racecourse and the Arabian Sea. A benchmark for Worli resale pricing." },
  { slug: "lodha-park", name: "Lodha Park", developer: "lodha", market: "India", city: "Mumbai", region: "Maharashtra", community: "Lower Parel", assetClass: "Residential", status: "ready", handover: "Completed 2021", currency: "INR", priceMin: cr(4.2), priceMax: cr(14), pricePerSqft: 52_500, units: 1_400, grossYield: 2.6, rera: "MahaRERA P51900002168", lat: 19.003, lng: 72.825, paymentPlan: null, description: "Seven-acre private park with five towers on the former mill land of Lower Parel, next to the Worli business district." },
  { slug: "lodha-malabar", name: "Lodha Malabar", developer: "lodha", market: "India", city: "Mumbai", region: "Maharashtra", community: "Malabar Hill", assetClass: "Residential", status: "under_construction", handover: "Q4 2027", currency: "INR", priceMin: cr(28), priceMax: cr(75), pricePerSqft: 118_000, units: 88, grossYield: 1.8, rera: "MahaRERA P51900050781", lat: 18.954, lng: 72.799, paymentPlan: "Construction-linked, 10% on agreement", description: "Sea-facing tower on Walkeshwar Road, one of Mumbai's scarcest addresses. Redevelopment of a 1960s building under DCPR 33(7)." },
  { slug: "oberoi-360-west", name: "Oberoi Three Sixty West", developer: "oberoi", market: "India", city: "Mumbai", region: "Maharashtra", community: "Worli", assetClass: "Branded Residence", status: "ready", handover: "Completed 2023", currency: "INR", priceMin: cr(45), priceMax: cr(120), pricePerSqft: 112_000, units: 172, grossYield: 1.9, rera: "MahaRERA P51900000118", lat: 19.006, lng: 72.818, paymentPlan: null, description: "Twin towers with a Ritz-Carlton hotel and serviced residences on Annie Besant Road. The record per-square-foot transactions in Mumbai since 2023." },
  { slug: "oberoi-esquire", name: "Oberoi Esquire", developer: "oberoi", market: "India", city: "Mumbai", region: "Maharashtra", community: "Goregaon East", assetClass: "Residential", status: "ready", handover: "Completed 2019", currency: "INR", priceMin: cr(3.8), priceMax: cr(9.5), pricePerSqft: 36_500, units: 1_260, grossYield: 2.9, rera: "MahaRERA P51800000542", lat: 19.17, lng: 72.86, paymentPlan: null, description: "Part of the Oberoi Garden City campus off the Western Express Highway, with offices, a school and a Westin hotel inside the gate." },
  { slug: "oberoi-enigma", name: "Oberoi Enigma", developer: "oberoi", market: "India", city: "Mumbai", region: "Maharashtra", community: "Mulund West", assetClass: "Residential", status: "ready", handover: "Completed 2022", currency: "INR", priceMin: cr(3.1), priceMax: cr(8.2), pricePerSqft: 28_400, units: 1_320, grossYield: 3.0, rera: "MahaRERA P51800000189", lat: 19.176, lng: 72.948, paymentPlan: null, description: "Twin-tower development in Eternia Enigma, Mulund, on the eastern edge of the Sanjay Gandhi National Park." },
  { slug: "rustomjee-crown", name: "Rustomjee Crown", developer: "rustomjee", market: "India", city: "Mumbai", region: "Maharashtra", community: "Prabhadevi", assetClass: "Residential", status: "ready", handover: "Completed 2024", currency: "INR", priceMin: cr(7.2), priceMax: cr(18), pricePerSqft: 61_000, units: 480, grossYield: 2.3, rera: "MahaRERA P51900001467", lat: 19.016, lng: 72.828, paymentPlan: null, description: "Three sea-facing towers in Prabhadevi on a cluster redevelopment under DCPR 33(9)." },
  { slug: "rustomjee-seasons", name: "Rustomjee Seasons", developer: "rustomjee", market: "India", city: "Mumbai", region: "Maharashtra", community: "Bandra East (BKC)", assetClass: "Residential", status: "ready", handover: "Completed 2021", currency: "INR", priceMin: cr(4.8), priceMax: cr(11), pricePerSqft: 46_000, units: 580, grossYield: 2.8, rera: "MahaRERA P51800006421", lat: 19.062, lng: 72.852, paymentPlan: null, description: "Residences next to the Bandra Kurla Complex financial district, built on a MHADA layout redevelopment." },
  { slug: "rustomjee-paramount", name: "Rustomjee Paramount", developer: "rustomjee", market: "India", city: "Mumbai", region: "Maharashtra", community: "Khar West", assetClass: "Residential", status: "under_construction", handover: "Q2 2027", currency: "INR", priceMin: cr(6.5), priceMax: cr(14.5), pricePerSqft: 57_500, units: 210, grossYield: 2.4, rera: "MahaRERA P51800045632", lat: 19.071, lng: 72.834, paymentPlan: "Construction-linked, 10% on agreement", description: "Society redevelopment in Khar West with existing members rehoused in the same tower; free-sale units released in two phases." },
  { slug: "prestige-ocean-towers", name: "Prestige Ocean Towers", developer: "prestige", market: "India", city: "Mumbai", region: "Maharashtra", community: "Marine Lines", assetClass: "Residential", status: "under_construction", handover: "Q1 2028", currency: "INR", priceMin: cr(9.8), priceMax: cr(26), pricePerSqft: 74_500, units: 190, grossYield: 2.1, rera: "MahaRERA P51900048216", lat: 18.943, lng: 72.823, paymentPlan: "Construction-linked, 10% on agreement", description: "Prestige's first South Mumbai tower, facing Marine Drive, on a slum rehabilitation scheme sanctioned by the SRA." },
  { slug: "prestige-jasdan-classic", name: "Prestige Jasdan Classic", developer: "prestige", market: "India", city: "Mumbai", region: "Maharashtra", community: "Mahalaxmi", assetClass: "Residential", status: "under_construction", handover: "Q3 2027", currency: "INR", priceMin: cr(8.5), priceMax: cr(21), pricePerSqft: 69_000, units: 230, grossYield: 2.2, rera: "MahaRERA P51900033871", lat: 18.982, lng: 72.818, paymentPlan: "Construction-linked", description: "Twin towers on Bhulabhai Desai Road overlooking the Mahalaxmi Racecourse, a joint development with the Jasdan estate." },
  { slug: "hiranandani-gardens", name: "Hiranandani Gardens Glen Gate", developer: "hiranandani", market: "India", city: "Mumbai", region: "Maharashtra", community: "Powai", assetClass: "Residential", status: "ready", handover: "Completed 2018", currency: "INR", priceMin: cr(3.2), priceMax: cr(9), pricePerSqft: 33_500, units: 940, grossYield: 3.1, rera: "MahaRERA P51800000817", lat: 19.118, lng: 72.909, paymentPlan: null, description: "Neo-classical towers in the Powai township, the established address for Mumbai's technology and consulting workforce. Deep rental market." },
  { slug: "hiranandani-castle-rock", name: "Hiranandani Castle Rock", developer: "hiranandani", market: "India", city: "Mumbai", region: "Maharashtra", community: "Powai", assetClass: "Residential", status: "under_construction", handover: "Q4 2026", currency: "INR", priceMin: cr(4.1), priceMax: cr(10.5), pricePerSqft: 35_800, units: 420, grossYield: 3.0, rera: "MahaRERA P51800024461", lat: 19.121, lng: 72.905, paymentPlan: "Construction-linked", description: "Final residential phase on the Powai lakefront; MahaRERA registration extended once under s.6 after a pandemic-era delay." },
  { slug: "sun-assagao-villas", name: "Sun Estates Assagao Villas", developer: "sun-estates", market: "India", city: "Assagao", region: "Goa", community: "Assagao, Bardez", assetClass: "Villa", status: "ready", handover: "Completed 2023", currency: "INR", priceMin: cr(5.5), priceMax: cr(9), pricePerSqft: 21_500, units: 18, grossYield: 5.6, rera: "PRGO04230789", lat: 15.596, lng: 73.775, paymentPlan: null, description: "Eighteen Indo-Portuguese villas with private pools in Assagao, North Goa's most sought-after village for second homes. Strong holiday-let yields." },
  { slug: "sun-aldona-reserve", name: "Sun Estates Aldona Reserve", developer: "sun-estates", market: "India", city: "Aldona", region: "Goa", community: "Aldona, Bardez", assetClass: "Villa", status: "under_construction", handover: "Q2 2027", currency: "INR", priceMin: cr(4.2), priceMax: cr(7), pricePerSqft: 17_800, units: 24, grossYield: 5.2, rera: "PRGO09251102", lat: 15.592, lng: 73.871, paymentPlan: "Construction-linked, 10% on agreement", description: "Riverside villas on the Mapusa river in Aldona; part of the site sits in CRZ-III, which fixes the no-development setback." },
  { slug: "acron-waterfront", name: "Acron Waterfront Residences", developer: "acron", market: "India", city: "Porvorim", region: "Goa", community: "Porvorim, Bardez", assetClass: "Serviced Residence", status: "ready", handover: "Completed 2021", currency: "INR", priceMin: cr(1.4), priceMax: cr(3.1), pricePerSqft: 13_200, units: 120, grossYield: 6.4, rera: "PRGO02210314", lat: 15.535, lng: 73.822, paymentPlan: null, description: "Serviced apartments on the Mandovi with a managed rental pool, ten minutes from Panaji." },
  { slug: "acron-siolim-hills", name: "Acron Siolim Hills", developer: "acron", market: "India", city: "Siolim", region: "Goa", community: "Siolim, Bardez", assetClass: "Villa", status: "under_construction", handover: "Q4 2026", currency: "INR", priceMin: cr(3.6), priceMax: cr(6.2), pricePerSqft: 16_900, units: 32, grossYield: 5.4, rera: "PRGO11240551", lat: 15.629, lng: 73.761, paymentPlan: "Construction-linked", description: "Hillside villas above the Chapora river. Part of the land carries an orchard zoning under RP 2021; only the settlement portion is buildable." },
  { slug: "acron-panjim-heights", name: "Acron Panjim Heights", developer: "acron", market: "India", city: "Panaji", region: "Goa", community: "Altinho, Panaji", assetClass: "Residential", status: "ready", handover: "Completed 2019", currency: "INR", priceMin: cr(1.1), priceMax: cr(2.4), pricePerSqft: 12_400, units: 86, grossYield: 4.6, rera: "PRGO05190112", lat: 15.495, lng: 73.83, paymentPlan: null, description: "Apartments on Altinho hill in the capital, held mostly by owner-occupiers and civil servants." },
  { slug: "veera-strand", name: "Veera Strand Park", developer: "veera", market: "India", city: "Candolim", region: "Goa", community: "Candolim, Bardez", assetClass: "Residential", status: "ready", handover: "Completed 2017", currency: "INR", priceMin: cr(1.6), priceMax: cr(3.4), pricePerSqft: 14_600, units: 140, grossYield: 5.9, rera: "PRGO03170087", lat: 15.517, lng: 73.763, paymentPlan: null, description: "Holiday apartments a short walk from Candolim beach. Title on one wing derives from a Comunidade de Candolim aforamento." },
  { slug: "veera-vagator-cove", name: "Veera Vagator Cove", developer: "veera", market: "India", city: "Vagator", region: "Goa", community: "Vagator, Bardez", assetClass: "Villa", status: "off_plan", handover: "Q3 2028", currency: "INR", priceMin: cr(6.8), priceMax: cr(11.5), pricePerSqft: 24_000, units: 14, grossYield: 5.8, rera: "PRGO06260214", lat: 15.6, lng: 73.744, paymentPlan: "10% on agreement, 40% on plinth, 50% on completion", description: "Cliff-top villas above Ozran beach. Conversion sanad applied for under s.32; construction licence awaits it." },
  { slug: "veera-moira-gardens", name: "Veera Moira Gardens", developer: "veera", market: "India", city: "Moira", region: "Goa", community: "Moira, Bardez", assetClass: "Residential", status: "ready", handover: "Completed 2022", currency: "INR", priceMin: cr(0.9), priceMax: cr(1.8), pricePerSqft: 9_800, units: 64, grossYield: 4.8, rera: "PRGO07220341", lat: 15.59, lng: 73.833, paymentPlan: null, description: "Low-rise apartments in the heritage village of Moira, priced for first homes and long lets." },
  { slug: "empire-benaulim", name: "Empire Benaulim Bay", developer: "empire", market: "India", city: "Benaulim", region: "Goa", community: "Benaulim, Salcete", assetClass: "Residential", status: "under_construction", handover: "Q1 2027 (revised)", currency: "INR", priceMin: cr(1.2), priceMax: cr(2.6), pricePerSqft: 11_800, units: 96, grossYield: 5.0, rera: "PRGO08210276", lat: 15.256, lng: 73.928, paymentPlan: "Construction-linked", description: "Beach-belt apartments in South Goa, twice delayed. A mundkar claim on the rear plot is pending before the Mamlatdar of Salcete." },
  { slug: "empire-margao-central", name: "Empire Margao Central", developer: "empire", market: "India", city: "Margao", region: "Goa", community: "Margao, Salcete", assetClass: "Mixed-use", status: "ready", handover: "Completed 2020", currency: "INR", priceMin: cr(0.8), priceMax: cr(1.9), pricePerSqft: 9_200, units: 150, grossYield: 5.3, rera: "PRGO01200045", lat: 15.273, lng: 73.958, paymentPlan: null, description: "Retail podium with apartments above in Margao's commercial centre." },
  { slug: "empire-colva-palms", name: "Empire Colva Palms", developer: "empire", market: "India", city: "Colva", region: "Goa", community: "Colva, Salcete", assetClass: "Villa", status: "ready", handover: "Completed 2018", currency: "INR", priceMin: cr(2.4), priceMax: cr(4.4), pricePerSqft: 13_900, units: 22, grossYield: 5.5, rera: "PRGO10180098", lat: 15.279, lng: 73.922, paymentPlan: null, description: "Gated villa enclave behind Colva beach, outside the CRZ setback." },
  { slug: "sun-anjuna-retreat", name: "Sun Estates Anjuna Retreat", developer: "sun-estates", market: "India", city: "Anjuna", region: "Goa", community: "Anjuna, Bardez", assetClass: "Villa", status: "ready", handover: "Completed 2020", currency: "INR", priceMin: cr(4.6), priceMax: cr(7.8), pricePerSqft: 19_600, units: 12, grossYield: 6.1, rera: "PRGO02200133", lat: 15.583, lng: 73.744, paymentPlan: null, description: "Twelve villas on Comunidade de Anjuna land granted on aforamento in 1971, converted to settlement use in 2016." },
];

export const TENANT = { name: "PropFolios", slug: "propfolios" };

export const STAFF = [
  { key: "amol", name: "Amol Bandekar", email: "amol@propfolios.ae", role: "tenant_admin" as const, title: "Founder and Managing Partner" },
  { key: "aisha", name: "Aisha Rahman", email: "aisha.rahman@propfolios.ae", role: "analyst" as const, title: "Senior Analyst, UAE" },
  { key: "rohan", name: "Rohan Mehta", email: "rohan.mehta@propfolios.ae", role: "analyst" as const, title: "Analyst, India and Cross-border" },
];

export type HoldingSeed = { property: string; unit: string; acquired: string; costLocal: number; valueLocal: number };

export type ClientSeed = {
  key: string;
  name: string;
  email: string;
  type: string;
  nationality: string;
  residency: string;
  domicile: string;
  aumAed: number;
  riskProfile: string;
  rm: "aisha" | "rohan";
  policy: { targetNetYield: number; maxOffPlanPct: number; maxSingleAssetPct: number; markets: ("UAE" | "India")[]; horizonYears: number; notes: string };
  holdings: HoldingSeed[];
};

export const CLIENTS: ClientSeed[] = [
  {
    key: "ahmed",
    name: "Ahmed Al Mansoori",
    email: "ahmed@almansoori.ae",
    type: "HNWI",
    nationality: "Emirati",
    residency: "UAE resident",
    domicile: "Dubai",
    aumAed: 25_000_000,
    riskProfile: "Balanced",
    rm: "aisha",
    policy: { targetNetYield: 5, maxOffPlanPct: 30, maxSingleAssetPct: 25, markets: ["UAE"], horizonYears: 7, notes: "Prefers prime Dubai with family-use optionality. No leverage." },
    holdings: [
      { property: "downtown-views", unit: "Tower 1, 2BR, 1,240 sq ft", acquired: "2022-03-14", costLocal: 3_100_000, valueLocal: 4_050_000 },
      { property: "marina-shores", unit: "3BR, 1,820 sq ft, off-plan", acquired: "2024-06-20", costLocal: 4_600_000, valueLocal: 5_010_000 },
      { property: "arabian-ranches-iii", unit: "4BR villa, 3,100 sq ft", acquired: "2023-09-05", costLocal: 3_600_000, valueLocal: 4_300_000 },
      { property: "sobha-hartland", unit: "1BR, 760 sq ft", acquired: "2021-11-22", costLocal: 1_450_000, valueLocal: 2_150_000 },
    ],
  },
  {
    key: "priya",
    name: "Priya Sharma",
    email: "priya.sharma@outlook.com",
    type: "HNWI",
    nationality: "Indian",
    residency: "NRI, UAE resident",
    domicile: "Dubai",
    aumAed: 8_000_000,
    riskProfile: "Growth",
    rm: "rohan",
    policy: { targetNetYield: 5.5, maxOffPlanPct: 40, maxSingleAssetPct: 30, markets: ["UAE", "India"], horizonYears: 10, notes: "Building a two-country portfolio. Wants rupee income to fund family obligations in Mumbai." },
    holdings: [
      { property: "jvc-residences", unit: "1BR, 720 sq ft", acquired: "2022-05-10", costLocal: 950_000, valueLocal: 1_180_000 },
      { property: "binghatti-heights", unit: "1BR, 790 sq ft", acquired: "2023-02-18", costLocal: 1_250_000, valueLocal: 1_520_000 },
      { property: "lodha-amara", unit: "Tower 14, 2BHK, 950 sq ft", acquired: "2021-08-03", costLocal: cr(1.6), valueLocal: cr(2.05) },
      { property: "prestige-lakeside", unit: "Block F, 3BHK, 1,580 sq ft", acquired: "2022-11-12", costLocal: cr(2.2), valueLocal: cr(2.62) },
    ],
  },
  {
    key: "khalid",
    name: "Khalid bin Rashid",
    email: "office@binrashid.ae",
    type: "UHNWI",
    nationality: "Emirati",
    residency: "UAE resident",
    domicile: "Abu Dhabi",
    aumAed: 80_000_000,
    riskProfile: "Balanced",
    rm: "aisha",
    policy: { targetNetYield: 4.5, maxOffPlanPct: 25, maxSingleAssetPct: 20, markets: ["UAE"], horizonYears: 10, notes: "Family office mandate. Capital preservation first; opportunistic exits where pricing exceeds base case." },
    holdings: [
      { property: "palm-beach-towers", unit: "Tower 2, penthouse, 4,250 sq ft", acquired: "2020-10-08", costLocal: 9_500_000, valueLocal: 16_800_000 },
      { property: "saadiyat-reserve", unit: "5BR villa, 6,100 sq ft", acquired: "2022-01-17", costLocal: 8_200_000, valueLocal: 10_900_000 },
      { property: "mamsha-al-saadiyat", unit: "Two 3BR beachfront units", acquired: "2021-06-02", costLocal: 6_400_000, valueLocal: 8_700_000 },
      { property: "cavalli-tower", unit: "Two 2BR units, off-plan", acquired: "2024-03-11", costLocal: 9_600_000, valueLocal: 10_200_000 },
      { property: "safa-one", unit: "Half-floor, 4BR, off-plan", acquired: "2023-05-24", costLocal: 12_000_000, valueLocal: 14_400_000 },
      { property: "yas-acres", unit: "4BR villa, 3,600 sq ft", acquired: "2022-09-06", costLocal: 5_100_000, valueLocal: 6_300_000 },
    ],
  },
  {
    key: "rajesh",
    name: "Rajesh Mehta",
    email: "rajesh@mehtacapital.in",
    type: "HNWI",
    nationality: "Indian",
    residency: "NRI, UAE resident",
    domicile: "Dubai",
    aumAed: 15_000_000,
    riskProfile: "Balanced",
    rm: "rohan",
    policy: { targetNetYield: 5, maxOffPlanPct: 30, maxSingleAssetPct: 25, markets: ["UAE", "India"], horizonYears: 8, notes: "Uses a Dubai-based holding company for UAE assets. Prefers Mumbai and NCR in India." },
    holdings: [
      { property: "business-bay-heights", unit: "Two 1BR units", acquired: "2022-02-21", costLocal: 2_600_000, valueLocal: 3_300_000 },
      { property: "bayz-101", unit: "2BR, off-plan", acquired: "2023-07-14", costLocal: 1_900_000, valueLocal: 2_200_000 },
      { property: "godrej-aristocrat", unit: "4BHK, 3,200 sq ft, under construction", acquired: "2022-12-09", costLocal: cr(4.5), valueLocal: cr(5.4) },
      { property: "oberoi-sky-city", unit: "Tower C, 3BHK", acquired: "2021-04-26", costLocal: cr(2.9), valueLocal: cr(3.8) },
      { property: "ellington-house", unit: "2BR park-facing, off-plan", acquired: "2023-11-03", costLocal: 3_400_000, valueLocal: 3_900_000 },
    ],
  },
  {
    key: "fatima",
    name: "Fatima Al Suwaidi",
    email: "fatima.alsuwaidi@icloud.com",
    type: "HNWI",
    nationality: "Emirati",
    residency: "UAE resident",
    domicile: "Dubai",
    aumAed: 12_000_000,
    riskProfile: "Income",
    rm: "aisha",
    policy: { targetNetYield: 6, maxOffPlanPct: 20, maxSingleAssetPct: 30, markets: ["UAE"], horizonYears: 6, notes: "Income focus. Distributions fund family expenses quarterly." },
    holdings: [
      { property: "belgravia-heights", unit: "1BR, 830 sq ft", acquired: "2022-06-15", costLocal: 1_600_000, valueLocal: 2_000_000 },
      { property: "sobha-creek-vistas", unit: "2BR, off-plan", acquired: "2023-03-27", costLocal: 2_400_000, valueLocal: 2_700_000 },
      { property: "yas-acres", unit: "3BR townhouse", acquired: "2021-10-19", costLocal: 3_300_000, valueLocal: 4_400_000 },
      { property: "starz-by-danube", unit: "Studio and 1BR", acquired: "2024-01-08", costLocal: 1_100_000, valueLocal: 1_200_000 },
    ],
  },
];

/** Monthly market series, oldest first. Index 0 is twelve months ago. */
export const MARKET_SERIES: Record<string, { tx: number[]; psf: number[]; offPlan: number[]; yield: number[]; supply: number[]; absorption: number[] }> = {
  Dubai: {
    tx: [14_820, 15_340, 13_960, 16_210, 15_880, 17_420, 16_950, 18_310, 17_640, 18_920, 19_480, 20_120],
    psf: [1_582, 1_596, 1_604, 1_623, 1_641, 1_652, 1_676, 1_694, 1_712, 1_733, 1_751, 1_772],
    offPlan: [58.2, 59.1, 57.4, 60.3, 61.0, 60.4, 62.1, 61.7, 62.9, 63.4, 62.8, 64.1],
    yield: [6.9, 6.9, 6.8, 6.8, 6.8, 6.7, 6.7, 6.7, 6.6, 6.6, 6.6, 6.5],
    supply: [3_900, 4_200, 3_600, 4_800, 5_100, 4_400, 4_900, 5_600, 5_200, 6_100, 5_800, 6_400],
    absorption: [91, 90, 90, 89, 88, 88, 87, 87, 86, 86, 85, 85],
  },
  "Abu Dhabi": {
    tx: [2_410, 2_520, 2_280, 2_690, 2_740, 2_810, 2_760, 2_950, 3_020, 3_110, 3_090, 3_240],
    psf: [1_118, 1_124, 1_131, 1_142, 1_150, 1_163, 1_171, 1_184, 1_192, 1_206, 1_214, 1_228],
    offPlan: [52.4, 53.1, 51.8, 54.2, 55.0, 54.6, 56.1, 55.8, 57.0, 57.4, 56.9, 58.1],
    yield: [6.4, 6.4, 6.4, 6.3, 6.3, 6.3, 6.2, 6.2, 6.2, 6.1, 6.1, 6.1],
    supply: [900, 1_050, 820, 1_200, 1_100, 980, 1_240, 1_310, 1_180, 1_420, 1_360, 1_500],
    absorption: [93, 93, 92, 92, 92, 91, 91, 91, 90, 90, 90, 89],
  },
  Sharjah: {
    tx: [1_620, 1_680, 1_540, 1_760, 1_810, 1_790, 1_870, 1_920, 1_960, 2_010, 2_050, 2_110],
    psf: [742, 746, 751, 758, 763, 769, 776, 781, 789, 796, 802, 811],
    offPlan: [38.1, 38.6, 37.9, 39.4, 40.0, 39.7, 40.8, 41.1, 41.6, 42.0, 41.8, 42.5],
    yield: [7.4, 7.4, 7.3, 7.3, 7.3, 7.2, 7.2, 7.2, 7.1, 7.1, 7.1, 7.0],
    supply: [520, 600, 480, 640, 700, 620, 680, 720, 690, 760, 740, 800],
    absorption: [89, 89, 88, 88, 88, 87, 87, 87, 87, 86, 86, 86],
  },
  "Ras Al Khaimah": {
    tx: [410, 430, 390, 470, 490, 520, 540, 580, 610, 640, 670, 710],
    psf: [902, 911, 918, 931, 944, 958, 971, 989, 1_004, 1_021, 1_039, 1_058],
    offPlan: [61.0, 62.4, 60.8, 63.5, 64.1, 65.0, 66.2, 66.8, 67.5, 68.1, 68.9, 69.6],
    yield: [7.8, 7.8, 7.7, 7.7, 7.6, 7.6, 7.5, 7.5, 7.4, 7.4, 7.3, 7.3],
    supply: [120, 140, 110, 160, 180, 170, 210, 240, 220, 260, 280, 300],
    absorption: [94, 94, 94, 93, 93, 93, 92, 92, 92, 91, 91, 91],
  },
};

/** Average transaction size by region, AED, used to derive monthly volume. */
export const AVG_TICKET_AED: Record<string, number> = { Dubai: 3_150_000, "Abu Dhabi": 2_840_000, Sharjah: 1_120_000, "Ras Al Khaimah": 1_960_000 };
