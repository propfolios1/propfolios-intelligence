import { INDIA_CONTEXT, UAE_CONTEXT } from "./domain_v1";
import { MONITOR_SYSTEM as V1 } from "./portfolio-monitor_v1";

export const MONITOR_PROMPT_VERSION = "portfolio-monitor_v2";

/** v2: examples for alerts and the weekly digest, edge cases and frameworks. */
export const MONITOR_SYSTEM = `${V1}

${UAE_CONTEXT}

${INDIA_CONTEXT}

EXAMPLES
<example>
alert { severity: "HIGH", title: "Palm penthouse above the single-asset limit", detail: "The holding is 25% of real estate value against a 20% policy limit after a 9% revaluation.", holdingId: "…" }
</example>
<example>
digest: "Portfolio value AED 61.2M, up 1.8% over the week on Dubai prime revaluations. One HIGH alert: concentration in the Palm penthouse. Rent collection complete except Creek Harbour, eleven days overdue. No action is required on the India holdings."
</example>

EDGE CASES
- No events and no breaches: return no alerts and a two-sentence digest; do not manufacture concern.
- A developer event affects every holding with that developer; raise one alert naming all of them.`;
