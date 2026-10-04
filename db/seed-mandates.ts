import type { DDFinding, DebateOutput, ResearchOutput, UnderwritingOutput } from "@/lib/ai/schemas";

/**
 * Seed content for the three demonstration mandates. Narrative is written to
 * investment-committee standard; every number is either computed by the
 * financial engine at seed time or drawn from the seed catalogue.
 */

const ACCESSED = "2026-09-08";

/* ===================================================================== */
/* MND-0001  Downtown Dubai Allocation  (Ahmed Al Mansoori)   DELIVERED  */
/* ===================================================================== */

export const DOWNTOWN = {
  reference: "MND-0001",
  title: "Downtown Dubai Allocation",
  client: "ahmed",
  property: "burj-crown",
  analyst: "aisha",
  brief:
    "Allocate up to AED 4.2M into a completed prime Downtown Dubai apartment with immediate rental income. Client values liquidity and optional family use. No leverage, seven-year view, net yield target of 5%.",
  objective: "Prime Downtown income asset with resale liquidity",
  ticketSizeAed: 4_200_000,
  horizonYears: 5,
  research: {
    summary:
      "Burj Crown is a completed 412-unit Emaar tower on the Downtown boulevard, pricing at AED 2,880 per sq ft against a submarket median of AED 2,790 over the last six months [1][3]. Downtown has the deepest ready-unit resale market in Dubai and gross yields of 6.0% to 6.3% on recent leases [2]. The principal risk is the 2026 to 2028 citywide supply cycle, which is concentrated in mid-market communities rather than Downtown [4].",
    sections: [
      {
        heading: "Market context",
        body: "Dubai recorded 20,120 residential transactions in the latest month, the highest monthly count on record, with off-plan sales at 64.1% of activity [1]. Median prices rose 12.0% over twelve months to AED 1,772 per sq ft citywide [1].\n\nDowntown has tracked the prime index rather than the citywide median: prime values rose 9.4% year on year, with ready units outperforming off-plan resales by roughly 2 percentage points as end-users competed for completed stock [2].",
      },
      {
        heading: "The asset",
        body: "Burj Crown comprises 412 one to three bedroom units over 42 floors, completed in Q2 2023 [3]. The proposed allocation is a 1,460 sq ft two-bedroom unit on a high floor with a Burj Khalifa outlook at AED 4.2M, or AED 2,877 per sq ft.\n\nService charges are AED 19.6 per sq ft per year under the 2026 Mollak budget, in line with Emaar Downtown towers of the same vintage [5].",
      },
      {
        heading: "Developer",
        body: "Emaar Properties has delivered 118 projects with a 96% on-time record and three active litigation matters, none relating to Burj Crown [6]. The company is listed on the Dubai Financial Market and carries an investment-grade balance sheet, which supports the community's long-term maintenance standards.",
      },
      {
        heading: "Comparable transactions",
        body: "Eleven ready two-bedroom transactions in Burj Crown and the adjacent Burj Royale and Grande towers over the last six months cleared at a median AED 2,790 per sq ft, with a range of AED 2,610 to AED 3,040 [1]. The proposed price is a 3.1% premium to the median, justified by floor height and view corridor.",
      },
      {
        heading: "Demand drivers",
        body: "Corporate leasing demand in Downtown is anchored by the DIFC and Business Bay office clusters, which recorded office occupancy above 90% in the first half of the year [2]. Short-let licensing through the Department of Economy and Tourism provides a secondary income route at higher gross yields, subject to building rules.",
      },
      {
        heading: "Regulatory context",
        body: "As a UAE national, the client faces no foreign ownership restrictions. Acquisition costs comprise the 4% DLD transfer fee, 2% agency commission and AED 4,200 in trustee and title deed fees [5]. A property of this value qualifies for a ten-year Golden Visa for any non-national family members who hold title jointly.",
      },
    ],
    risks: [
      { severity: "MEDIUM", title: "2026 to 2028 supply cycle", detail: "Citywide completions are forecast to exceed 60,000 units in 2027. Supply is concentrated in JVC, Dubailand and MBR City; Downtown's pipeline is under 1,200 units." },
      { severity: "LOW", title: "Service charge inflation", detail: "Mollak budgets for Emaar Downtown towers rose 6% year on year. A further 15% rise would reduce net yield by roughly 25 basis points." },
      { severity: "LOW", title: "Short-let regulation", detail: "Holiday-home permits can be withdrawn at building level. The underwriting assumes long-let income only." },
    ],
    dataGaps: ["DATA_GAP: unit_level_rent_roll: Emaar does not publish unit-level leases; yields are inferred from Ejari-registered comparables."],
    citations: [
      { id: 1, source: "Dubai Land Department", title: "Real estate transactions open data", url: "https://dubailand.gov.ae/en/open-data/real-estate-data/", accessed: ACCESSED },
      { id: 2, source: "Knight Frank", title: "Dubai Residential Market Review, Q2", url: "https://www.knightfrank.ae/research", accessed: ACCESSED },
      { id: 3, source: "Emaar Properties", title: "Burj Crown project fact sheet", url: "https://www.emaar.com/en/what-we-do/communities/downtown-dubai", accessed: ACCESSED },
      { id: 4, source: "Property Monitor", title: "Dubai supply pipeline tracker", url: "https://www.propertymonitor.ae", accessed: ACCESSED },
      { id: 5, source: "Dubai Land Department", title: "Mollak service charge index and fee schedule", url: "https://dubailand.gov.ae/en/eservices/service-charge-index/", accessed: ACCESSED },
      { id: 6, source: "Emaar Properties", title: "Investor relations, annual report", url: "https://www.emaar.com/en/investor-relations", accessed: ACCESSED },
    ],
  } satisfies ResearchOutput,
  assumptions: {
    purchasePrice: 4_200_000,
    paymentPlan: [{ year: 0, pct: 1 }],
    handoverYear: 0,
    holdYears: 5,
    grossYield: 0.061,
    rentGrowth: 0.03,
    vacancy: 0.05,
    opexRatio: 0.17,
    capitalGrowth: 0.055,
    acquisitionCostPct: 0.061,
    exitCostPct: 0.02,
    discountRate: 0.08,
    volatility: { capitalGrowthSd: 0.035, rentGrowthSd: 0.015, vacancySd: 0.03, delayProbability: 0 },
    rationale: [
      { assumption: "Gross yield 6.1%", basis: "Median of eleven Ejari-registered two-bedroom leases in Burj Crown and adjacent towers, applied to the AED 4.2M price." },
      { assumption: "Capital growth 5.5% a year", basis: "Well below the 9.4% trailing prime growth; haircut for the 2027 supply peak and mean reversion toward the ten-year prime average." },
      { assumption: "Opex 17% of gross rent", basis: "AED 19.6 per sq ft service charge plus 5% leasing and management fee." },
      { assumption: "Acquisition costs 6.1%", basis: "4% DLD transfer fee, 2% agency, trustee and title deed fees." },
      { assumption: "Discount rate 8%", basis: "Client's stated hurdle for unlevered prime residential." },
    ],
  } satisfies UnderwritingOutput,
  findings: [
    { id: "dd-1", severity: "LOW", category: "Title", title: "Clean title, no encumbrances", description: "Title deed search returns a single registered owner and no mortgage or caveat.", evidence: "DLD title deed verification, unit 3804", action: "No action required." },
    { id: "dd-2", severity: "LOW", category: "Escrow", title: "Project escrow closed on completion", description: "Escrow account released on completion certificate in 2023; no outstanding developer obligations.", evidence: "RERA escrow register, project 2015", action: "No action required." },
    { id: "dd-3", severity: "MEDIUM", category: "Service charges", title: "Service charges rose 6% year on year", description: "2026 Mollak budget of AED 19.6 per sq ft, up from AED 18.5.", evidence: "Mollak budget approval, January 2026", action: "Underwrite at AED 21 per sq ft from year three." },
    { id: "dd-4", severity: "MEDIUM", category: "Valuation", title: "3.1% premium to comparable median", description: "Asking price AED 2,877 per sq ft against an AED 2,790 six-month median.", evidence: "Eleven DLD-registered transactions, March to August 2026", action: "Negotiate to AED 4.1M or obtain a RICS valuation supporting the floor premium." },
    { id: "dd-5", severity: "LOW", category: "Legal", title: "Existing lease transfers with the unit", description: "Unit is let at AED 252,000 a year until March 2027 under an Ejari-registered contract.", evidence: "Ejari certificate 2025/1144201", action: "Obtain tenant notice and rent deposit transfer at completion." },
    { id: "dd-6", severity: "LOW", category: "Regulatory", title: "No short-let permit on file", description: "The unit holds no holiday-home permit; long-let income is assumed.", evidence: "DET permit search", action: "None. Short-let upside excluded from base case." },
  ] satisfies DDFinding[],
  debate: {
    bull: {
      thesis: "Completed prime stock in Downtown is structurally scarce, and the unit generates a 6% gross yield from day one with the deepest resale liquidity in the city.",
      points: [
        { title: "Scarcity of completed prime", detail: "Downtown's pipeline is under 1,200 units to 2028 against a 2027 citywide peak above 60,000.", evidence: "Property Monitor supply tracker [4]" },
        { title: "Income from day one", detail: "An Ejari-registered lease at AED 252,000 a year covers a 6.0% gross yield before any rental growth.", evidence: "Ejari certificate 2025/1144201" },
        { title: "Exit liquidity", detail: "Burj Crown and its neighbours cleared eleven two-bedroom resales in six months, with a median time on market of 41 days.", evidence: "DLD transactions [1]" },
        { title: "Developer quality", detail: "Emaar's 96% on-time record and investment-grade balance sheet protect maintenance standards and resale value.", evidence: "Emaar annual report [6]" },
      ],
      rebuttal: "The supply wave is a mid-market story. Prime Downtown completions are a fraction of the total, and ready prime units outperformed off-plan resales through the last cycle.",
      confidence: 0.74,
    },
    bear: {
      thesis: "The entry price already reflects the prime premium, leaving thin margin for error if the 2027 supply peak softens rents citywide.",
      points: [
        { title: "Paying above comparables", detail: "AED 2,877 per sq ft is a 3.1% premium to the six-month median.", evidence: "DLD transactions [1]" },
        { title: "Rent spill-over", detail: "New mid-market supply in Business Bay and MBR City competes for the same corporate tenant pool.", evidence: "Knight Frank [2]" },
        { title: "Service charge drift", detail: "Mollak budgets rose 6% in a year; compounding at that rate erodes net yield by 25 basis points by year four.", evidence: "Mollak budget [5]" },
      ],
      rebuttal: "Even at P10 the asset clears the client's capital-preservation constraint, but the margin over the 8% hurdle is narrow in the downside.",
      confidence: 0.46,
    },
    judge: {
      recommendation: "Proceed with conditions",
      riskRating: "Low",
      rationale:
        "The bull case is better evidenced: the asset is completed, let and liquid, and the supply argument is weaker for prime Downtown than for the city. The bear's pricing point is valid and is addressed by a negotiated price condition. Base-case returns clear the 8% hurdle with a low probability of capital loss.",
      decisiveArguments: ["Completed and let, removing construction and vacancy risk at entry", "Prime Downtown supply is a small share of the 2027 pipeline"],
      conditions: ["Price at or below AED 4.1M, or a RICS valuation supporting AED 4.2M", "Transfer of the existing lease and deposit at completion", "Re-underwrite if Downtown ready-unit volumes fall 20% over two quarters"],
      confidence: 0.78,
    },
  } satisfies DebateOutput,
};

/* ===================================================================== */
/* MND-0002  India Commercial Allocation  (Priya Sharma)      RESEARCH   */
/* ===================================================================== */

export const INDIA = {
  reference: "MND-0002",
  title: "India Commercial Allocation",
  client: "priya",
  property: "m3m-golfestate",
  analyst: "rohan",
  brief:
    "Evaluate a INR 4 crore allocation into the retail and office podium at M3M Golfestate, Gurugram, to create rupee income for family commitments in Mumbai. Client is an NRI resident in Dubai; repatriation and FEMA treatment must be confirmed before any commitment.",
  objective: "Rupee-denominated income with repatriation clarity",
  ticketSizeAed: 1_800_000,
  horizonYears: 7,
};

/* ===================================================================== */
/* MND-0003  Palm Jumeirah Exit  (Khalid bin Rashid)            MEMO     */
/* ===================================================================== */

export const PALM = {
  reference: "MND-0003",
  title: "Palm Jumeirah Exit",
  client: "khalid",
  property: "palm-beach-towers",
  analyst: "aisha",
  brief:
    "Advise whether to sell the Palm Beach Towers penthouse now, at an indicative AED 16.8M, or hold for a further three years. The family office wants to recycle capital into Abu Dhabi if the hold case does not clear its 7% hurdle on today's value.",
  objective: "Sell or hold decision on a prime Palm Jumeirah penthouse",
  ticketSizeAed: 16_800_000,
  horizonYears: 3,
  research: {
    summary:
      "The penthouse was acquired in October 2020 for AED 9.5M and is now indicatively worth AED 16.8M, a 77% gain [1]. Palm Jumeirah prime prices have risen for 18 consecutive quarters, but the rate of growth has halved over the last four, and gross yields on the trunk have compressed to 4.6% [2]. The question is whether the next three years of income and growth justify holding at today's value.",
    sections: [
      {
        heading: "Market context",
        body: "Palm Jumeirah ultra-prime transactions above AED 15M fell 11% by count year on year while values per square foot still rose 7.8%, a pattern consistent with a maturing upcycle [1]. Prime growth slowed from 22% to 9% annualised over the last four quarters [2].",
      },
      {
        heading: "The asset",
        body: "A 4,250 sq ft penthouse in Tower 2 with a 1,100 sq ft terrace and direct sea views, acquired on completion terms in October 2020. The unit is let to a corporate tenant at AED 775,000 a year until June 2027 [3].",
      },
      {
        heading: "Developer and community",
        body: "Nakheel, now within Dubai Holding, maintains the Palm's infrastructure and has a stable 83% on-time delivery record. The trunk's beachfront and rooftop pool remain key differentiators against newer Palm towers [4].",
      },
      {
        heading: "Comparable transactions",
        body: "Four Palm Beach Towers penthouse and sub-penthouse sales in the last nine months cleared between AED 3,790 and AED 4,120 per sq ft. At AED 16.8M, the unit is priced at AED 3,953 per sq ft, mid-range [1].",
      },
      {
        heading: "Reinvestment options",
        body: "The family office's Abu Dhabi alternatives, including Saadiyat beachfront, offer gross yields of 5.0% to 5.6% with lower volatility, and Abu Dhabi prime growth has accelerated while Dubai prime decelerates [2].",
      },
    ],
    risks: [
      { severity: "MEDIUM", title: "Decelerating prime growth", detail: "Annualised prime growth halved over four quarters; the hold case relies on 3% annual growth." },
      { severity: "MEDIUM", title: "Yield compression", detail: "A 4.6% gross yield on today's value is below the family office's 4.5% net target after costs." },
      { severity: "LOW", title: "Tenant break option", detail: "The corporate lease carries a six-month break option from June 2026." },
    ],
    dataGaps: ["DATA_GAP: buyer_depth_above_15m: DLD does not disclose cash versus mortgage share for ultra-prime transactions."],
    citations: [
      { id: 1, source: "Dubai Land Department", title: "Real estate transactions open data", url: "https://dubailand.gov.ae/en/open-data/real-estate-data/", accessed: ACCESSED },
      { id: 2, source: "Knight Frank", title: "Prime Global Cities Index", url: "https://www.knightfrank.com/research", accessed: ACCESSED },
      { id: 3, source: "Dubai Land Department", title: "Ejari tenancy registration", url: "https://dubailand.gov.ae/en/eservices/ejari/", accessed: ACCESSED },
      { id: 4, source: "Nakheel", title: "Palm Jumeirah community information", url: "https://www.nakheel.com/en/communities/palm-jumeirah", accessed: ACCESSED },
    ],
  } satisfies ResearchOutput,
  assumptions: {
    purchasePrice: 16_800_000,
    paymentPlan: [{ year: 0, pct: 1 }],
    handoverYear: 0,
    holdYears: 3,
    grossYield: 0.046,
    rentGrowth: 0.02,
    vacancy: 0.06,
    opexRatio: 0.16,
    capitalGrowth: 0.03,
    acquisitionCostPct: 0,
    exitCostPct: 0.02,
    discountRate: 0.07,
    volatility: { capitalGrowthSd: 0.045, rentGrowthSd: 0.015, vacancySd: 0.04, delayProbability: 0 },
    rationale: [
      { assumption: "Entry at AED 16.8M", basis: "Holding is valued at today's indicative sale price, the opportunity cost of not selling." },
      { assumption: "Capital growth 3% a year", basis: "Half the trailing four-quarter prime growth, reflecting deceleration." },
      { assumption: "Gross yield 4.6%", basis: "Current lease of AED 775,000 on AED 16.8M." },
      { assumption: "Vacancy 6%", basis: "Break option and re-letting period for an ultra-prime unit." },
      { assumption: "Discount rate 7%", basis: "Family office hurdle for hold decisions." },
    ],
  } satisfies UnderwritingOutput,
  findings: [
    { id: "dd-1", severity: "LOW", category: "Title", title: "Title held by family SPV", description: "Title registered to Bin Rashid Holdings FZE; share transfer route available for a buyer.", evidence: "DLD title deed, unit T2-PH02", action: "Confirm the buyer's preferred transfer route before marketing." },
    { id: "dd-2", severity: "MEDIUM", category: "Legal", title: "Tenant break option from June 2026", description: "Corporate lease includes a six-month break option, which affects buyer appetite either way.", evidence: "Lease clause 14.2", action: "Market with the lease as an income feature; offer vacant possession as an option." },
    { id: "dd-3", severity: "LOW", category: "Service charges", title: "Service charges stable", description: "AED 31 per sq ft, flat for two years.", evidence: "Mollak budget 2026", action: "No action required." },
    { id: "dd-4", severity: "MEDIUM", category: "Valuation", title: "Thin comparable set above AED 15M", description: "Only four comparable sales in nine months; pricing evidence is sensitive to a single transaction.", evidence: "DLD transactions", action: "Commission a RICS valuation before setting the asking price." },
  ] satisfies DDFinding[],
  debate: {
    bull: {
      thesis: "Holding captures continued Palm scarcity and a secure corporate income stream, and avoids a 2% exit cost at what may not be the peak.",
      points: [
        { title: "Irreplaceable product", detail: "No new Palm trunk penthouse supply is scheduled to 2029.", evidence: "Nakheel [4]" },
        { title: "Secure income", detail: "A corporate tenant at AED 775,000 a year until 2027.", evidence: "Ejari [3]" },
        { title: "Growth has not reversed", detail: "Values per square foot still rose 7.8% year on year.", evidence: "DLD [1]" },
      ],
      rebuttal: "Deceleration is not decline; the hold case only needs 3% growth.",
      confidence: 0.48,
    },
    bear: {
      thesis: "The hold case does not clear the family office's 7% hurdle on today's value; selling now crystallises a 77% gain into an accelerating Abu Dhabi market.",
      points: [
        { title: "Hurdle not met", detail: "The P50 hold IRR sits below the 7% hurdle on today's value.", evidence: "Underwriting" },
        { title: "Late-cycle signals", detail: "Ultra-prime volumes fell 11% while prices rose, a classic late-cycle divergence.", evidence: "DLD [1]" },
        { title: "Better use of capital", detail: "Saadiyat beachfront offers 5.0% to 5.6% gross with lower volatility.", evidence: "Knight Frank [2]" },
        { title: "Concentration", detail: "The penthouse is 25% of the family office's real estate value, above its 20% single-asset limit.", evidence: "Portfolio" },
      ],
      rebuttal: "Palm scarcity is real but already priced; the question is forward return, not quality.",
      confidence: 0.71,
    },
    judge: {
      recommendation: "Proceed",
      riskRating: "Moderate",
      rationale:
        "The decision turns on forward return from today's value, not the quality of the asset. The hold case does not clear the 7% hurdle at P50, late-cycle signals are present, and the asset breaches the single-asset limit. Selling now and redeploying into Abu Dhabi beachfront is the better risk-adjusted outcome.",
      decisiveArguments: ["P50 hold IRR below the 7% hurdle", "Single-asset concentration above policy"],
      conditions: ["Commission a RICS valuation before marketing", "List at no less than AED 16.5M with lease in place", "Redeploy proceeds within two quarters to avoid cash drag"],
      confidence: 0.76,
    },
  } satisfies DebateOutput,
};

/* --------------------------------------------------------------- memos */

export function downtownMemoHtml(s: { p10: number; p50: number; p90: number; multiple: number; exit: number; cashYield: number }) {
  const m = (n: number) => `AED ${(n / 1e6).toFixed(2)}M`;
  return `<h2>Recommendation</h2>
<p><strong>Proceed with conditions.</strong> Allocate AED 4.2M to a completed two-bedroom unit in Burj Crown, Downtown Dubai, subject to the price and lease-transfer conditions below. The asset is let, liquid and delivered by Dubai's strongest developer, and the base case clears the 8% hurdle.</p>
<h2>Investment thesis</h2>
<p>Completed prime stock in Downtown is scarce relative to the 2027 citywide supply peak, which is concentrated in mid-market communities. The unit produces a 6.1% gross yield from completion and trades in the most liquid resale market in the city [1][4].</p>
<h2>Returns</h2>
<p>Over a five-year hold, the base case (P50) delivers an unlevered IRR of ${s.p50.toFixed(1)}% and an equity multiple of ${s.multiple.toFixed(2)}x, with an exit value of ${m(s.exit)}. The downside case (P10) returns ${s.p10.toFixed(1)}%; the upside (P90) ${s.p90.toFixed(1)}%. Average net cash yield is ${s.cashYield.toFixed(1)}% on cost.</p>
<h2>The asset</h2>
<p>A 1,460 sq ft two-bedroom unit on a high floor of Burj Crown, completed in 2023 and let to a corporate tenant at AED 252,000 a year until March 2027. Service charges are AED 19.6 per sq ft.</p>
<h2>Market</h2>
<p>Dubai recorded 20,120 transactions in the latest month, a record, with prime values up 9.4% year on year. Eleven comparable two-bedroom resales in six months cleared at a median AED 2,790 per sq ft [1].</p>
<h2>Key risks and mitigants</h2>
<ul>
<li><strong>Price premium.</strong> The asking price is 3.1% above the comparable median. Mitigated by a negotiated price or valuation condition.</li>
<li><strong>Supply cycle.</strong> 2027 completions peak citywide. Downtown's own pipeline is under 1,200 units.</li>
<li><strong>Service charges.</strong> Underwritten at AED 21 per sq ft from year three.</li>
</ul>
<blockquote>Scarce, completed and let: the case rests on quality of income rather than on growth.</blockquote>
<h2>Conditions</h2>
<ol>
<li>Price at or below AED 4.1M, or a RICS valuation supporting AED 4.2M.</li>
<li>Transfer of the existing lease and AED 12,600 deposit at completion.</li>
<li>Re-underwrite if Downtown ready-unit volumes fall 20% over two quarters.</li>
</ol>
<h2>Next steps</h2>
<p>On approval, Nakhla Demo Brokerage will submit the offer, instruct the RICS valuation and coordinate the DLD transfer through a registered trustee office, targeting completion within 30 days.</p>`;
}

export function palmMemoHtml(s: { p10: number; p50: number; p90: number; exit: number }) {
  return `<h2>Recommendation</h2>
<p><strong>Sell.</strong> Market the Palm Beach Towers penthouse at no less than AED 16.5M with the lease in place, and redeploy the proceeds into Abu Dhabi beachfront within two quarters.</p>
<h2>Why now</h2>
<p>Holding for three more years from today's AED 16.8M value produces a base-case IRR of ${s.p50.toFixed(1)}%, below the family office's 7% hurdle. The downside case returns ${s.p10.toFixed(1)}% and the upside ${s.p90.toFixed(1)}%. Ultra-prime volumes on the Palm fell 11% year on year while prices still rose, a late-cycle divergence [1].</p>
<h2>Gain crystallised</h2>
<p>The unit was acquired in October 2020 for AED 9.5M. A sale at AED 16.8M crystallises a 77% gain before costs.</p>
<h2>Concentration</h2>
<p>The penthouse represents 25% of the family's real estate value, above the 20% single-asset limit in its investment policy.</p>
<h2>Redeployment</h2>
<p>Saadiyat beachfront alternatives offer 5.0% to 5.6% gross yields, with Abu Dhabi prime growth accelerating as Dubai prime decelerates [2].</p>`;
}
