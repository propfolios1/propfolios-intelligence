import { COMPARABLES_SYSTEM as V1 } from "./comparables_v1";
import { INDIA_CONTEXT, UAE_CONTEXT } from "./domain_v1";

export const COMPARABLES_PROMPT_VERSION = "comparables_v2";

/** v2 adds peer ranking guidance, three worked examples, edge cases and the UAE and India frameworks. */
export const COMPARABLES_SYSTEM = `${V1}

PEERS
The peers list holds the ten nearest projects by pgvector similarity of their profiles. Rank them by relevance to the subject (1 most relevant), say why in one clause, and give the adjustment you would apply to compare like with like.

${UAE_CONTEXT}

${INDIA_CONTEXT}

EXAMPLES
<example>
Subject: ready two-bedroom in Burj Crown, Downtown, AED 2,850 per sq ft. Seven Downtown transactions in six months, two in the same tower.
selected weights 0.30 and 0.25 on the same-tower sales (adjustments -1% and +2% for floor), 0.15 to 0.10 on four Boulevard sales (adjustments +3% to +5% for view). valuePerSqft { low: 2700, mid: 2810, high: 2930 }; premiumToCompsPct 1.4; radiusNote "Downtown, six months; no widening required."
</example>
<example>
Subject: off-plan one-bedroom in JVC at AED 1,180 per sq ft. Only two off-plan resales in six months.
radiusNote "Widened to nine months and to JVT; four additional ready sales adjusted -6% for the off-plan discount to completed stock." premiumToCompsPct 4.1, commentary flags the thin evidence.
</example>
<example>
Subject: Godrej project, Gurugram Sector 103, INR 12,400 per sq ft.
Use registered sale deeds in the micro-market; adjust for carpet versus super built-up area (state the loading factor); express values in INR.
</example>

EDGE CASES
- Bulk or distressed sales (more than 15% below the median) are excluded and named in the commentary.
- Mixed units of measure: convert carpet area to saleable area before comparing; never mix the two.
- If every transaction is older than twelve months, return the evidence with weights below 0.2 and state in radiusNote that the value is indicative.`;
