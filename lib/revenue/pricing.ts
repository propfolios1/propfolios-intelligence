/**
 * Listing price intelligence. Pure: estimates what a listing should achieve
 * from the firm's own comparable listings, places the asking price against
 * that range, and predicts days on market at the asking price and at the
 * estimate.
 *
 * Comparables are weighted by how alike they are (community, property type,
 * bedrooms, size), how good their evidence is (an achieved sale or letting
 * counts more than an asking price) and how recent they are. The regional
 * median price per square foot acts as a prior worth three comparables, so
 * a listing with few comparables is still estimated sensibly.
 */

export interface PricedListing {
  id: string;
  reference: string;
  title: string;
  community: string;
  city: string;
  propertyType: string;
  purpose: "sale" | "rent";
  status: "draft" | "active" | "under_offer" | "sold" | "let" | "withdrawn";
  price: number;
  currency: string;
  bedrooms: number | null;
  area: number;
  areaUnit: "sqft" | "sqm";
  listedAt: Date | null;
  /** When the listing last changed status; for sold and let listings, the completion date. */
  updatedAt: Date;
}

export interface Comparable {
  id: string;
  reference: string;
  title: string;
  community: string;
  status: PricedListing["status"];
  psf: number;
  price: number;
  bedrooms: number | null;
  sqft: number;
  weight: number;
  daysOnMarket: number | null;
}

export interface PriceEstimate {
  sqft: number;
  askingPsf: number;
  psf: { p10: number; p50: number; p90: number };
  value: { p10: number; p50: number; p90: number };
  /** Asking price against the P50 estimate: 0.08 is 8% above. */
  premium: number;
  position: "below" | "in_line" | "above" | "well_above";
  comparables: Comparable[];
  /** Comparables weight, plus the prior's three. */
  evidence: number;
  confidence: "high" | "medium" | "low";
  dom: { atAsking: number; atEstimate: number; baseline: number; sellWithin90AtAsking: number; sellWithin90AtEstimate: number; daysListed: number | null };
  advice: string;
}

const SQM = 10.7639;
const DAY = 86_400_000;
/** How strongly days on market respond to price: each 10% over the market adds about a quarter. */
const ELASTICITY = 2.2;
const PRIOR_WEIGHT = 3;

export const toSqft = (area: number, unit: "sqft" | "sqm") => (unit === "sqm" ? area * SQM : area);

/** Weighted quantile by midpoint cumulative weight, linearly interpolated between neighbours and clamped at the ends. */
export function weightedQuantile(items: { v: number; w: number }[], q: number): number {
  const sorted = items.filter((x) => x.w > 0).sort((a, b) => a.v - b.v);
  if (!sorted.length) return 0;
  const total = sorted.reduce((a, x) => a + x.w, 0);
  let acc = 0;
  const pos = sorted.map((x) => {
    const p = (acc + x.w / 2) / total;
    acc += x.w;
    return p;
  });
  if (q <= pos[0]!) return sorted[0]!.v;
  if (q >= pos.at(-1)!) return sorted.at(-1)!.v;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (q <= pos[i + 1]!) {
      const t = (q - pos[i]!) / (pos[i + 1]! - pos[i]!);
      return sorted[i]!.v + (sorted[i + 1]!.v - sorted[i]!.v) * t;
    }
  }
  return sorted.at(-1)!.v;
}

function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Similarity of a comparable to the subject, 0 to 1, before evidence quality and recency. */
export function similarity(subject: PricedListing, c: PricedListing): number {
  let w = 1;
  if (c.community !== subject.community) w *= c.city === subject.city ? 0.45 : 0.1;
  if (c.propertyType.toLowerCase() !== subject.propertyType.toLowerCase()) w *= 0.5;
  if (subject.bedrooms !== null && c.bedrooms !== null) w *= Math.pow(0.6, Math.abs(subject.bedrooms - c.bedrooms));
  const ratio = toSqft(c.area, c.areaUnit) / Math.max(1, toSqft(subject.area, subject.areaUnit));
  w *= Math.exp(-Math.abs(Math.log(ratio)) * 1.2);
  return w;
}

const EVIDENCE: Record<PricedListing["status"], number> = { sold: 1, let: 1, under_offer: 0.85, active: 0.55, withdrawn: 0.25, draft: 0 };

export function estimatePrice(subject: PricedListing, pool: PricedListing[], opts: { now?: Date; marketPsf?: number | null; marketDom?: number } = {}): PriceEstimate {
  const now = opts.now ?? new Date();
  const sqft = toSqft(subject.area, subject.areaUnit);
  const askingPsf = subject.price / Math.max(1, sqft);
  const comps: Comparable[] = pool
    .filter((c) => c.id !== subject.id && c.purpose === subject.purpose && c.currency === subject.currency && c.area > 0 && c.price > 0 && EVIDENCE[c.status] > 0)
    .map((c) => {
      const ageDays = (now.getTime() - (c.status === "sold" || c.status === "let" ? c.updatedAt : (c.listedAt ?? c.updatedAt)).getTime()) / DAY;
      const recency = Math.exp(-Math.max(0, ageDays) / 365);
      const cs = toSqft(c.area, c.areaUnit);
      const dom = (c.status === "sold" || c.status === "let") && c.listedAt ? Math.max(1, Math.round((c.updatedAt.getTime() - c.listedAt.getTime()) / DAY)) : null;
      return { id: c.id, reference: c.reference, title: c.title, community: c.community, status: c.status, psf: c.price / cs, price: c.price, bedrooms: c.bedrooms, sqft: cs, weight: similarity(subject, c) * EVIDENCE[c.status] * recency, daysOnMarket: dom };
    })
    .filter((c) => c.weight > 0.02)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12);

  const points = comps.map((c) => ({ v: c.psf, w: c.weight }));
  const prior = opts.marketPsf && opts.marketPsf > 0 ? opts.marketPsf : null;
  if (prior) {
    // The prior is spread as a band of ±12% around the regional median so it widens rather than pins the range.
    for (const k of [0.88, 1, 1.12]) points.push({ v: prior * k, w: PRIOR_WEIGHT / 3 });
  }
  if (!points.length) points.push({ v: askingPsf, w: 1 });
  const psf = { p10: weightedQuantile(points, 0.1), p50: weightedQuantile(points, 0.5), p90: weightedQuantile(points, 0.9) };
  const value = { p10: psf.p10 * sqft, p50: psf.p50 * sqft, p90: psf.p90 * sqft };
  const premium = value.p50 ? subject.price / value.p50 - 1 : 0;
  const position = premium < -0.04 ? "below" : premium <= 0.04 ? "in_line" : premium <= 0.12 ? "above" : "well_above";
  const evidence = comps.reduce((a, c) => a + c.weight, 0);

  const observedDom = median(comps.filter((c) => c.daysOnMarket !== null).map((c) => c.daysOnMarket!));
  const baseline = observedDom ?? opts.marketDom ?? (subject.purpose === "rent" ? 30 : 75);
  const domAt = (prem: number) => Math.round(Math.min(365, Math.max(7, baseline * Math.exp(ELASTICITY * prem))));
  const atAsking = domAt(premium);
  const atEstimate = domAt(0);
  const daysListed = subject.listedAt ? Math.max(0, Math.round((now.getTime() - subject.listedAt.getTime()) / DAY)) : null;
  // Exponential time to sale: chance of completing within 90 days from today.
  const within = (dom: number) => 1 - Math.exp(-90 / dom);

  const pct = Math.round(Math.abs(premium) * 100);
  const advice =
    position === "well_above"
      ? `Asking is ${pct}% above what comparable ${subject.purpose === "rent" ? "lettings" : "sales"} support. At the estimate the model expects ${atEstimate} days on market instead of ${atAsking}.`
      : position === "above"
        ? `Asking is ${pct}% above the estimate: expect about ${atAsking - atEstimate} more days on market than a listing priced in line.`
        : position === "below"
          ? `Asking is ${pct}% below the estimate. Expect strong interest; confirm the owner's instruction before accepting a first offer.`
          : `Asking is in line with comparable evidence. Expected days on market: ${atAsking}.`;

  return {
    sqft,
    askingPsf,
    psf,
    value,
    premium,
    position,
    comparables: comps,
    evidence: evidence + (prior ? PRIOR_WEIGHT : 0),
    confidence: evidence >= 3 ? "high" : evidence >= 1.2 ? "medium" : "low",
    dom: { atAsking, atEstimate, baseline: Math.round(baseline), sellWithin90AtAsking: within(atAsking), sellWithin90AtEstimate: within(atEstimate), daysListed },
    advice,
  };
}
