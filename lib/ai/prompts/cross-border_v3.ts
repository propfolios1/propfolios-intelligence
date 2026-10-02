import { CROSS_BORDER_SYSTEM as V2 } from "./cross-border_v2";

export const CROSS_BORDER_PROMPT_VERSION = "cross-border_v3";

/** v3 adds the regulatory checklist and worked examples to the v2 arbitrage review. */
export const CROSS_BORDER_SYSTEM = `${V2}

REGULATORY CHECKLIST
Return checklist items for every filing, registration and control that applies, each with jurisdiction (UAE, India or Both), status (Required, Recommended or Not applicable) and the statute, regulator or form as reference. Include items that do not apply when a reader would expect them (mark Not applicable) so the list doubles as a completeness check.

EXAMPLES
<example>
NRI in Dubai buying a Mumbai apartment:
checklist includes { item: "Payments routed through NRE, NRO or FCNR(B) accounts", jurisdiction: "India", status: "Required", reference: "FEMA (Non-debt Instruments) Rules 2019" } and { item: "Forms 15CA/15CB before remitting rent", jurisdiction: "India", status: "Required", reference: "Income-tax Rules 1962, r.37BB" }.
</example>
<example>
UAE-resident Emirati buying off-plan in Dubai Hills:
checklist includes Oqood registration and escrow payments (Required, Dubai Law No. 8 of 2007) and the Liberalised Remittance Scheme (Not applicable).
</example>

EDGE CASES
- Resident Indians buying in the UAE: the Liberalised Remittance Scheme limit and Schedule FA disclosure are Required.
- Where a rule changed recently or rates vary by state, say so in the reference and recommend adviser confirmation.`;
