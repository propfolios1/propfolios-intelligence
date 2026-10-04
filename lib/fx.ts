/**
 * Display currencies for public prices. Nakhla bills in AED; other currencies
 * are indicative. Rates come from the European Central Bank's daily reference
 * rates through the Frankfurter API (free, no key). The ECB does not publish
 * AED, so AED is derived from its fixed peg to the US dollar (3.6725 AED per
 * USD, Central Bank of the UAE). If the rate service cannot be reached, the
 * fallback table below is used and labelled as such.
 */

export const CURRENCIES = ["AED", "USD", "INR", "GBP", "SGD", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const AED_PER_USD = 3.6725;

export const CURRENCY_META: Record<Currency, { label: string; flag: string; symbol: string; round: number }> = {
  AED: { label: "UAE dirham", flag: "🇦🇪", symbol: "AED", round: 1 },
  USD: { label: "US dollar", flag: "🇺🇸", symbol: "$", round: 1 },
  INR: { label: "Indian rupee", flag: "🇮🇳", symbol: "₹", round: 100 },
  GBP: { label: "Pound sterling", flag: "🇬🇧", symbol: "£", round: 1 },
  SGD: { label: "Singapore dollar", flag: "🇸🇬", symbol: "S$", round: 1 },
  AUD: { label: "Australian dollar", flag: "🇦🇺", symbol: "A$", round: 1 },
};

/** Units of each currency per US dollar. Fallback values are approximate and dated. */
export type Rates = { perUsd: Record<Currency, number>; date: string; source: "ecb" | "fallback" };
export const FALLBACK_RATES: Rates = { perUsd: { AED: AED_PER_USD, USD: 1, INR: 88.5, GBP: 0.745, SGD: 1.29, AUD: 1.52 }, date: "2026-09-30", source: "fallback" };

export function ratesFromFrankfurter(json: unknown): Rates | null {
  const j = json as { base?: string; date?: string; rates?: Record<string, number> };
  if (j?.base !== "USD" || !j.rates || !j.date) return null;
  const perUsd = { AED: AED_PER_USD, USD: 1 } as Record<Currency, number>;
  for (const c of ["INR", "GBP", "SGD", "AUD"] as const) {
    const v = j.rates[c];
    if (typeof v !== "number" || !(v > 0)) return null;
    perUsd[c] = v;
  }
  return { perUsd, date: j.date, source: "ecb" };
}

export async function fetchRates(fetcher: typeof fetch = fetch): Promise<Rates> {
  try {
    const res = await fetcher("https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR,GBP,SGD,AUD", { next: { revalidate: 21_600 }, signal: AbortSignal.timeout(4000) } as RequestInit);
    if (!res.ok) return FALLBACK_RATES;
    return ratesFromFrankfurter(await res.json()) ?? FALLBACK_RATES;
  } catch {
    return FALLBACK_RATES;
  }
}

/** Converts an AED amount, rounded to a clean figure for display. */
export function convertAed(aed: number, to: Currency, rates: Rates) {
  const v = (aed / AED_PER_USD) * rates.perUsd[to];
  const r = CURRENCY_META[to].round;
  return to === "AED" ? aed : Math.round(v / r) * r;
}

export function formatPrice(amount: number, c: Currency) {
  const n = amount.toLocaleString(c === "INR" ? "en-IN" : "en-US", { maximumFractionDigits: 0 });
  return c === "AED" ? `AED ${n}` : `${CURRENCY_META[c].symbol}${n}`;
}

/** Monthly price for a billing interval: annual billing is 20% off, shown per month. */
export function monthlyFor(priceAed: number, interval: "month" | "year", discount = 0.2) {
  return interval === "year" ? Math.round(priceAed * (1 - discount)) : priceAed;
}
