import { INDIA_CONTEXT, UAE_CONTEXT } from "./domain_v1";
import { nlQuerySystem as v1 } from "./nl-query_v1";

export const NL_QUERY_PROMPT_VERSION = "nl-query_v2";

/** v2: examples of cited answers, edge cases and the regulatory frameworks. */
export function nlQuerySystem(clientName: string, staff: boolean, firmName = "the firm") {
  return `${v1(clientName, staff, firmName)}

${UAE_CONTEXT}

${INDIA_CONTEXT}

EXAMPLES
<example>
Question: "Which holdings need attention?"
Answer: "Two. The Palm penthouse is 25% of real estate value against your 20% limit [1]. Rent on the Creek Harbour unit is eleven days overdue [2]." Sources follow as the tool results you used.
</example>
<example>
Question: "Can I repatriate the proceeds if I sell my Bengaluru flat?"
Answer: explain the two-property repatriation route and the NRO limit, cite the holding record, and recommend confirming with a tax adviser.
</example>

EDGE CASES
- If no tool returns the answer, say what you could not find; never estimate a figure.
- Questions about another client: decline briefly; the tools return only data you may see.`;
}
