import { goa } from "./goa";
import { maharashtra } from "./maharashtra";
import type { JurisdictionId, RegulatoryPlugin } from "./types";
import { uae } from "./uae";

export * from "./types";
export { maharashtra, MH_RATES, dcprCheck, DCPR_FSI } from "./maharashtra";
export { goa, GOA_RATES, RP2021_ZONES, CRZ_RULES } from "./goa";
export { uae, UAE_RATES } from "./uae";

export const PLUGINS = { maharashtra, goa, uae } as const;

export function pluginFor(j: JurisdictionId | string): RegulatoryPlugin {
  if (j === "mumbai" || j === "maharashtra") return maharashtra;
  if (j === "goa") return goa;
  return uae;
}

/** Maps a property's city and country to a rules-engine jurisdiction. */
export function jurisdictionOf(city: string, country?: string): JurisdictionId {
  const c = city.toLowerCase();
  if (/goa|panaji|panjim|assagao|anjuna|siolim|candolim|calangute|porvorim|vagator|margao|mapusa|aldona|parra|moira/.test(c)) return "goa";
  if (/mumbai|bombay|thane|navi mumbai|worli|bandra|juhu|powai|andheri|lower parel|malabar/.test(c)) return "mumbai";
  if (/pune|nagpur|nashik/.test(c)) return "maharashtra";
  if (/abu dhabi/.test(c)) return "abu_dhabi";
  if (country && /india/i.test(country)) return "maharashtra";
  return "dubai";
}

export const JURISDICTION_LABEL: Record<JurisdictionId, string> = { mumbai: "Mumbai", maharashtra: "Maharashtra", goa: "Goa", dubai: "Dubai", abu_dhabi: "Abu Dhabi" };
