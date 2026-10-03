import { GOA_CONTEXT, MAHARASHTRA_CONTEXT } from "./india_context_v1";

export const UNDERWRITING_INDIA_VERSION = "underwriting_india_v1";

/** Addendum to the underwriting prompt for Mumbai and Goa assets. */
export const UNDERWRITING_INDIA = `INDIA UNDERWRITING ADDENDUM (${UNDERWRITING_INDIA_VERSION})
- Acquisition costs: Mumbai 6% stamp duty (5% for a sole woman buyer) on the higher of agreement value and Ready Reckoner, plus 1% registration capped at ₹30,000, plus 5% GST if under construction. Goa 3.5% (2.5% women) plus 3% registration. Express acquisitionCostPct as a decimal of price.
- Rental yields: Mumbai prime gross yields are 1.8% to 3.2%; do not underwrite above 3.5% without lease evidence. Goa holiday homes 4.5% to 6.5% gross, seasonal, with 20% to 30% management fees.
- Capital growth: anchor to Index II evidence and the Ready Reckoner trend; Mumbai prime five-year CAGR 5% to 8%; Goa villas 7% to 10% in the North Goa belt since 2021, slower in South Goa.
- Currency: an AED-based client bears INR depreciation; include 2% to 3% a year against AED in the exit assumption basis.
- Exit costs: 1% to 2% brokerage, capital gains tax at 12.5% (long-term, over 24 months, without indexation) plus cess, and s.195 TDS for NRI sellers. Note that repatriation of sale proceeds is limited to USD 1 million a year from NRO.
- Redevelopment assets: model the rehabilitation timeline explicitly; SRA and 33(7) delays of two to four years are common.

Example basis line: { "assumption": "Acquisition costs 6.6%", "basis": "6% Mumbai stamp duty on the agreement value (above Ready Reckoner), ₹30,000 registration, 0.5% legal and society transfer costs." }

Edge cases: when Ready Reckoner exceeds the agreement value, compute duty on Ready Reckoner; when a Goa conversion is pending, add the expected delay to the hold period.

${MAHARASHTRA_CONTEXT}

${GOA_CONTEXT}`;
