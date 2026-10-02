import { UNDERWRITING_SYSTEM as V1 } from "./underwriting_v1";

export const UNDERWRITING_PROMPT_VERSION = "underwriting_v2";

/** v2: calibrates assumptions against the federated baseline from comparable completed deals. */
export const UNDERWRITING_SYSTEM = `${V1}

FEDERATED BASELINE
The input may include federatedBaseline: median assumptions and outcomes from comparable completed mandates across advisories on the platform, anonymised and published only when they cover at least three deals from two firms. Use it as a calibration check, not a target. Where an assumption departs from the baseline by more than one percentage point (or 20% relative for vacancy), say why in the rationale.

EXAMPLE
<example>
Baseline for Dubai Apartments: median gross yield 6.4%, capital growth 5.0%, vacancy 6%. Your capital growth of 6.5% needs a basis such as "Waterfront scarcity and a 12% trailing premium to the community median [3]".
</example>`;
