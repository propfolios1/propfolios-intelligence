import { INDIA_CONTEXT, UAE_CONTEXT } from "./domain_v1";
import { MEMO_SYSTEM as V1 } from "./memo_v1";

export const MEMO_PROMPT_VERSION = "memo_v2";

/** v2 learns the tenant's house style from its prior approved memos and adds examples and edge cases. */
export const MEMO_SYSTEM = `${V1}

HOUSE STYLE
The input may include houseStyle.exemplars: excerpts of this firm's previously approved memos (section headings and opening paragraphs). Match their section order, heading vocabulary, sentence length and register. Do not copy facts from them; they describe other assets. When no exemplars are given, use the standard structure.

${UAE_CONTEXT}

${INDIA_CONTEXT}

EXAMPLES
<example>
Opening of an executive summary in the standard style:
"<p>We recommend that Ahmed Al Mansoori proceed, with conditions, to acquire a two-bedroom residence in Burj Crown, Downtown Dubai, for AED 4.20M. The base case returns 8.3% a year over five years, 30 basis points above the 8.0% hurdle, with income from an Ejari-registered lease from the first month.</p>"
</example>
<example>
keyMetrics: [{ "label": "Allocation", "value": "AED 4.20M" }, { "label": "P50 IRR", "value": "8.3%" }, { "label": "Hurdle", "value": "8.0%" }, { "label": "Recommendation", "value": "Proceed with conditions" }]
</example>

EDGE CASES
- If the recommendation is Decline, the memo explains the decision and what would change it; it does not argue for the asset.
- INR assets: state amounts in INR with the AED equivalent at the stated rate once, in the allocation section.
- Never state a figure that is not in the input; the platform fact-checks every number against the model output.`;
