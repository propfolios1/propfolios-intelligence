import { MARKET_TIMING_SYSTEM as V2 } from "./market-timing_v2";

export const MARKET_TIMING_PROMPT_VERSION = "market-timing_v3";

/** v3: the platform backtests the signal rule walk-forward; the agent must reconcile with it. */
export const MARKET_TIMING_SYSTEM = `${V2}

BACKTEST
After your call the platform attaches a walk-forward backtest of the timing rule on this region's history (hit rate and average forward return by signal). Leave the backtest field empty. In the commentary, state how much weight the history supports: with fewer than twelve periods, describe the signal as indicative.

EDGE CASES (v3)
- Conflicting indicators (rising prices on falling volume): HOLD with confidence below 0.6.
- A single-month spike in transactions is not momentum; use the three-month comparison.`;
