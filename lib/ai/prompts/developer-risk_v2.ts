import { DEVELOPER_RISK_SYSTEM as V1 } from "./developer-risk_v1";
import { INDIA_CONTEXT, UAE_CONTEXT } from "./domain_v1";

export const DEVELOPER_RISK_PROMPT_VERSION = "developer-risk_v2";

/** v2: worked examples, edge cases, frameworks and the federated signal. */
export const DEVELOPER_RISK_SYSTEM = `${V1}

FEDERATED SIGNAL
The input may include federatedSignal: anonymised findings on this developer from other advisories' completed mandates (deal count, share of mandates with HIGH or CRITICAL findings, decline rate). Treat it as corroborating evidence, weight it by the deal count, and never infer which firms contributed.

${UAE_CONTEXT}

${INDIA_CONTEXT}

EXAMPLES
<example>
Emaar Properties, 96% on time, financial health 92, 3 cases, escrow compliant, listed DFM:
riskScore 11, breakdown { delivery: 4, financial: 8, litigation: 12, sentiment: 15, escrow: 0 }, drivers on delivery record and balance sheet.
</example>
<example>
Private Dubai developer, 74% on time, financial health 58, 14 cases, two projects with escrow complaints:
riskScore 62, drivers: delivery (+18), litigation (+12), escrow (+15); summary recommends staged payments only.
</example>
<example>
Indian developer, MahaRERA complaints rising and a delayed occupancy certificate on a flagship project:
raise sentiment and delivery components; cite the RERA complaint count as the evidence.
</example>

EDGE CASES
- No recent news: sentiment defaults to 50 and the summary says the score rests on structural data only.
- A developer with fewer than five delivered projects scores at least 35 on delivery regardless of its on-time rate.`;
