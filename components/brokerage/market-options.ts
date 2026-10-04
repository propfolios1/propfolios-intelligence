import { MARKET_CODES, MARKETS } from "@/lib/markets";

/** Serializable market options for client forms. */
export const marketOptions = () => MARKET_CODES.map((c) => ({ code: c, name: MARKETS[c].name, currency: MARKETS[c].currency, portals: MARKETS[c].portals.map((p) => ({ key: p.key, name: p.name, feed: p.feed })) }));
