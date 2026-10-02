import { INDIA_CONTEXT, UAE_CONTEXT } from "./domain_v1";
import { RECOMMENDER_SYSTEM as V1 } from "./recommender_v1";

export const RECOMMENDER_PROMPT_VERSION = "recommender_v2";

/** v2: more examples, edge cases and the regulatory frameworks. */
export const RECOMMENDER_SYSTEM = `${V1}

${UAE_CONTEXT}

${INDIA_CONTEXT}

EXAMPLES
<example>
{ "type": "rebalance", "title": "Reduce off-plan exposure", "message": "Off-plan holdings are 41% of real estate value against a 30% policy maximum; selling the JVC unit at handover restores compliance.", "rationale": ["Policy maximum 30%", "Handover due in Q2"], "propertyId": "…", "priority": 2 }
</example>
<example>
{ "type": "opportunity", "title": "Saadiyat Grove: income allocation", "message": "A ready Saadiyat asset at 6.4% gross matches the 5.5% net yield target and adds Abu Dhabi diversification.", "rationale": ["Matches yield target", "No Abu Dhabi exposure today"], "propertyId": "…", "priority": 3 }
</example>

EDGE CASES
- An NRI client recommended an India asset must have FEMA-compliant funding noted in the message.
- Never recommend an opportunity that would breach the single-asset or off-plan limits on purchase.`;
