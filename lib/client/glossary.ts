/**
 * Plain-language definitions for the terms the portal uses. Each entry says
 * what the number means for the client, then how it is worked out.
 */
export interface GlossaryEntry {
  term: string;
  plain: string;
  how: string;
}

export const GLOSSARY = {
  value: { term: "Portfolio value", plain: "What your holdings would be worth today.", how: "The latest independent valuation of each property, or the most recent registered sale of a comparable unit where no valuation is due yet." },
  gain: { term: "Gain on cost", plain: "How much more your holdings are worth than you paid.", how: "Current value less purchase cost (price, registration fees and agency fees), as a percentage of that cost." },
  irr: { term: "IRR", plain: "Your average yearly return, counting when each payment and receipt happened.", how: "Internal rate of return across every cash flow: instalments, fees, rent received and today's value. It is weighted by what you invested in each property." },
  rent: { term: "Annual rent", plain: "Rent your let properties earn in a year.", how: "The contracted annual rent of every current tenancy, before service charges and management fees." },
  cashYield: { term: "Cash yield", plain: "Rent as a share of what you paid.", how: "Annual rent divided by total purchase cost. Gross yield, quoted on listings, divides by price instead." },
  grossYield: { term: "Gross yield", plain: "A property's rent as a share of its asking price.", how: "Expected annual rent divided by price, before service charges, maintenance and vacancy." },
  offPlan: { term: "Off-plan share", plain: "How much of your portfolio is still being built.", how: "Value of holdings before handover, as a share of total value. Off-plan homes earn no rent until they are completed." },
  handover: { term: "Handover", plain: "The date you receive the keys to a new home.", how: "The developer's scheduled completion date. Final payment and registration of title usually fall due at handover." },
  escrow: { term: "Escrow", plain: "A protected account holding your off-plan payments.", how: "In the UAE, RERA requires instalments to be paid into a project escrow account, released to the developer only as construction progresses." },
  rera: { term: "RERA", plain: "The real estate regulator for the project's location.", how: "In Dubai, the Real Estate Regulatory Agency; in India, the state authority under the Real Estate (Regulation and Development) Act 2016. A registration number means the project is registered with it." },
  capRate: { term: "Cap rate", plain: "Net yearly income as a share of value.", how: "Net operating income (rent less running costs) divided by value. Lower cap rates usually mean higher prices relative to income." },
  range: { term: "P10 / P50 / P90", plain: "A low, middle and high estimate.", how: "From thousands of simulated outcomes: one in ten falls below P10, half below P50, nine in ten below P90." },
  serviceCharge: { term: "Service charge", plain: "The yearly fee for a building's upkeep.", how: "Charged per square foot by the owners' association for maintenance, security, cooling and shared facilities." },
  ltv: { term: "Loan to value", plain: "How much of a property is financed by a mortgage.", how: "Outstanding loan divided by property value. For expatriate residents, UAE Central Bank rules cap lending at 80% of a first home valued up to AED 5 million, and 60% of a second home." },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
