import type { MarketBrief, ReportContent } from "@/db/schema";
import type { SubscriptionFilters } from "@/db/schema-production";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { formatMoney } from "@/lib/utils";

/**
 * Composes a client's market brief from the firm's own data: monthly market
 * statistics where the firm holds them, the firm's live listings, and the
 * developer inventory it syncs. Every figure in the brief is computed here
 * from those rows; nothing is estimated or invented, and a section with no
 * data says so.
 */

export type Frequency = "weekly" | "fortnightly" | "monthly";
export const FREQUENCY_LABEL: Record<Frequency, string> = { weekly: "Every Monday", fortnightly: "Every other Monday", monthly: "First Monday of the month" };

export type MarketRow = { region: string; month: string; transactions: number; medianPriceSqft: number; rentalYield: number; absorptionRate: number; supplyUnits: number };
export type ListingRow = { id: string; reference: string; title: string; market: string; city: string; community: string; propertyType: string; purpose: "sale" | "rent"; bedrooms: number | null; price: number; currency: string; area: number; areaUnit: "sqft" | "sqm"; listedAt: Date | null };
export type InventoryRow = { developer: string; market: string; project: string; unitRef: string; bedrooms: number | null; price: number | null; previousPrice: number | null; currency: string; status: string; firstSeenAt: Date; priceChangedAt: Date | null; statusChangedAt: Date | null };

const DAY = 86_400_000;

export function nextDue(frequency: Frequency, from: Date) {
  // Briefs go out on Monday at 06:00 UTC (10:00 in the Gulf, 11:30 in India).
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), 6));
  if (frequency === "monthly") {
    const first = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1, 6));
    while (first.getUTCDay() !== 1) first.setUTCDate(first.getUTCDate() + 1);
    return first;
  }
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7 || 7));
  if (frequency === "fortnightly") d.setUTCDate(d.getUTCDate() + 7);
  return d;
}

export function windowDays(frequency: Frequency) {
  return frequency === "weekly" ? 7 : frequency === "fortnightly" ? 14 : 31;
}

export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const year = t.getUTCFullYear();
  const week = Math.ceil(((t.getTime() - Date.UTC(year, 0, 1)) / DAY + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

export function periodKey(frequency: Frequency, at: Date, subscriptionId: string) {
  const key = frequency === "monthly" ? at.toISOString().slice(0, 7) : isoWeek(at);
  return `${key}#${subscriptionId.slice(0, 8)}`;
}

export function median(xs: number[]) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Whether a listing or unit meets the subscription's filters. */
export function matches(f: SubscriptionFilters, x: { market: string; community?: string; city?: string; propertyType?: string; bedrooms: number | null; price: number | null; purpose?: string }) {
  if (f.markets.length && !f.markets.includes(x.market)) return false;
  if (f.areas.length && x.community !== undefined && !f.areas.some((a) => a.toLowerCase() === x.community!.toLowerCase() || a.toLowerCase() === x.city?.toLowerCase())) return false;
  if (f.propertyTypes.length && x.propertyType && !f.propertyTypes.some((t) => t.toLowerCase() === x.propertyType!.toLowerCase())) return false;
  if (f.bedrooms.length && x.bedrooms !== null && !f.bedrooms.some((b) => (b >= 5 ? x.bedrooms! >= 5 : b === x.bedrooms))) return false;
  if (x.purpose && x.purpose !== f.purpose) return false;
  if (x.price !== null) {
    if (f.budgetMin !== null && x.price < f.budgetMin) return false;
    if (f.budgetMax !== null && x.price > f.budgetMax) return false;
  }
  return true;
}

/** The market-data regions (cities) covered by a subscription. */
export function regionsFor(f: SubscriptionFilters, listings: { city: string; community: string }[] = []) {
  const markets = (f.markets.length ? f.markets : ["AE"]) as MarketCode[];
  const cities = new Set<string>();
  for (const m of markets) for (const c of MARKETS[m]?.cities ?? []) cities.add(c);
  if (f.areas.length) {
    const fromAreas = new Set(listings.filter((l) => f.areas.some((a) => a.toLowerCase() === l.community.toLowerCase() || a.toLowerCase() === l.city.toLowerCase())).map((l) => l.city));
    for (const a of f.areas) if (cities.has(a)) fromAreas.add(a);
    if (fromAreas.size) return [...fromAreas];
  }
  return [...cities];
}

const pct = (a: number, b: number) => (b ? ((a - b) / b) * 100 : 0);
const signed = (n: number, dp = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;

export function composeBrief(input: {
  clientName: string;
  subscription: { id: string; name: string; filters: SubscriptionFilters; frequency: Frequency; includeInventory: boolean };
  now: Date;
  since: Date;
  market: MarketRow[];
  listings: ListingRow[];
  inventory: InventoryRow[];
}): { title: string; content: ReportContent; brief: MarketBrief } {
  const { subscription: sub, now, since } = input;
  const f = sub.filters;
  const cur = f.currency;
  const money = (n: number | null) => (n === null ? "n/a" : formatMoney(n, cur));
  const signals: MarketBrief["signals"] = [];

  // Monthly market series per region (median price per square foot).
  const byRegion = new Map<string, MarketRow[]>();
  for (const r of input.market) byRegion.set(r.region, [...(byRegion.get(r.region) ?? []), r].sort((a, b) => a.month.localeCompare(b.month)));
  const months = [...new Set(input.market.map((r) => r.month))].sort().slice(-12);
  const series = months.map((m) => {
    const row: MarketBrief["series"][number] = { month: m.slice(0, 7) };
    for (const [region, rows] of byRegion) {
      const hit = rows.find((r) => r.month === m);
      if (hit) row[region] = Math.round(hit.medianPriceSqft);
    }
    return row;
  });
  const marketLines: string[] = [];
  for (const [region, rows] of byRegion) {
    const last = rows[rows.length - 1]!;
    const yearAgo = rows.find((r) => r.month.slice(0, 7) === `${Number(last.month.slice(0, 4)) - 1}${last.month.slice(4, 7)}`) ?? rows[0]!;
    const yoy = pct(last.medianPriceSqft, yearAgo.medianPriceSqft);
    const recent = rows.slice(-3).reduce((a, r) => a + r.transactions, 0);
    const prior = rows.slice(-6, -3).reduce((a, r) => a + r.transactions, 0);
    const trend = prior ? pct(recent, prior) : 0;
    marketLines.push(`${region}: median ${formatMoney(last.medianPriceSqft, "AED")} per sq ft in ${last.month.slice(0, 7)}, ${signed(yoy)} on the year; ${recent.toLocaleString("en-GB")} transactions in the last three months (${signed(trend, 0)} on the three before); gross yield ${last.rentalYield.toFixed(1)}%.`);
    if (yoy >= 8) signals.push({ tone: "caution", text: `${region} prices are ${yoy.toFixed(1)}% higher than a year ago; entry yields are compressing.` });
    else if (yoy <= -3) signals.push({ tone: "positive", text: `${region} prices are ${Math.abs(yoy).toFixed(1)}% below a year ago, which improves entry pricing for buyers.` });
    // Stored as a fraction or as a percentage depending on the source.
    const absorption = last.absorptionRate > 1.5 ? last.absorptionRate / 100 : last.absorptionRate;
    if (absorption >= 0.85) signals.push({ tone: "neutral", text: `${region} absorption is ${(absorption * 100).toFixed(0)}%: new supply is being taken up quickly and negotiating room on new launches is limited.` });
    if (prior && trend <= -15) signals.push({ tone: "neutral", text: `${region} transaction volume fell ${Math.abs(trend).toFixed(0)}% over the last three months; sellers may be more open to offers.` });
  }

  // The firm's listings that match, with statistics per area.
  const matching = input.listings.filter((l) => matches(f, { ...l }));
  const ppsf = (l: ListingRow) => (l.area > 0 ? l.price / (l.areaUnit === "sqm" ? l.area * 10.7639 : l.area) : null);
  const areas = new Map<string, ListingRow[]>();
  for (const l of matching) areas.set(`${l.market}|${l.community}`, [...(areas.get(`${l.market}|${l.community}`) ?? []), l]);
  const areaStats: MarketBrief["areaStats"] = [...areas.entries()]
    .map(([k, ls]) => {
      const [market, area] = k.split("|") as [string, string];
      const older = ls.filter((l) => l.listedAt && l.listedAt < since).map(ppsf).filter((x): x is number => x !== null);
      const newer = ls.filter((l) => l.listedAt && l.listedAt >= since).map(ppsf).filter((x): x is number => x !== null);
      const mo = median(older);
      const all = median(ls.map(ppsf).filter((x): x is number => x !== null));
      const mn = median(newer);
      return { area, market, listings: ls.length, medianPrice: median(ls.map((l) => l.price)), medianPpsf: all === null ? null : Math.round(all), changePct: mo && mn ? Math.round(pct(mn, mo) * 10) / 10 : null };
    })
    .sort((a, b) => b.listings - a.listings);
  const fresh = matching.filter((l) => l.listedAt && l.listedAt >= since);
  const shown = [...fresh, ...matching.filter((l) => !fresh.includes(l))].slice(0, 12);
  const listingRows: MarketBrief["listings"] = shown.map((l) => ({ id: l.id, reference: l.reference, title: l.title, community: l.community, city: l.city, bedrooms: l.bedrooms, price: l.price, currency: l.currency, listedAt: l.listedAt?.toISOString() ?? null, isNew: fresh.includes(l) }));
  if (fresh.length) signals.push({ tone: "positive", text: `${fresh.length} ${fresh.length === 1 ? "home matching your criteria was" : "homes matching your criteria were"} listed by the firm since the last brief.` });

  // Developer inventory: new releases, price movements and units back on sale.
  const inv: MarketBrief["inventory"] = [];
  if (sub.includeInventory) {
    for (const u of input.inventory) {
      if (u.status !== "available" || !matches(f, { market: u.market, bedrooms: u.bedrooms, price: u.price })) continue;
      if (u.firstSeenAt >= since) inv.push({ developer: u.developer, project: u.project, unitRef: u.unitRef, bedrooms: u.bedrooms, price: u.price, previousPrice: null, currency: u.currency, change: "new" });
      else if (u.priceChangedAt && u.priceChangedAt >= since && u.previousPrice !== null && u.price !== null) inv.push({ developer: u.developer, project: u.project, unitRef: u.unitRef, bedrooms: u.bedrooms, price: u.price, previousPrice: u.previousPrice, currency: u.currency, change: u.price < u.previousPrice ? "price_cut" : "price_rise" });
      else if (u.statusChangedAt && u.statusChangedAt >= since) inv.push({ developer: u.developer, project: u.project, unitRef: u.unitRef, bedrooms: u.bedrooms, price: u.price, previousPrice: null, currency: u.currency, change: "available" });
    }
    const order = { price_cut: 0, new: 1, available: 2, price_rise: 3 };
    inv.sort((a, b) => order[a.change] - order[b.change] || (a.price ?? 0) - (b.price ?? 0));
    const cuts = inv.filter((x) => x.change === "price_cut");
    if (cuts.length) {
      const deepest = cuts.reduce((m, x) => (pct(x.price!, x.previousPrice!) < pct(m.price!, m.previousPrice!) ? x : m));
      signals.push({ tone: "positive", text: `${cuts.length} developer ${cuts.length === 1 ? "unit was" : "units were"} repriced lower; the largest reduction is ${deepest.project} ${deepest.unitRef}, ${Math.abs(pct(deepest.price!, deepest.previousPrice!)).toFixed(1)}% to ${formatMoney(deepest.price!, deepest.currency)}.` });
    }
  }

  const weekOf = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const title = `${sub.name}: market brief, ${sub.frequency === "monthly" ? now.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : `week of ${weekOf}`}`;
  const lead = signals[0]?.text ?? (matching.length ? `${matching.length} homes in the firm's current inventory match your criteria; prices are broadly unchanged since the last brief.` : "No homes in the firm's current inventory match your criteria this period; your adviser has been notified to source off-market options.");
  const sections: ReportContent["sections"] = [
    { heading: "Prices and activity", body: marketLines.length ? marketLines.join(" ") : `The firm does not hold monthly transaction statistics for ${f.markets.map((m) => MARKETS[m as MarketCode]?.name ?? m).join(", ") || "these markets"}; the figures below are drawn from the firm's live listings.` },
    {
      heading: "Asking prices in your areas",
      body: areaStats.length
        ? areaStats
            .slice(0, 5)
            .map((a) => `${a.area}: ${a.listings} ${a.listings === 1 ? "listing" : "listings"}, median ${money(a.medianPrice)}${a.medianPpsf ? ` (${money(Math.round(a.medianPpsf))} per sq ft)` : ""}${a.changePct !== null ? `, new listings ${signed(a.changePct)} against existing stock` : ""}.`)
            .join(" ")
        : "No live listings match the areas and budget you follow.",
    },
    { heading: "New to market", body: fresh.length ? `${fresh.length} new: ${fresh.slice(0, 4).map((l) => `${l.title} at ${formatMoney(l.price, l.currency)}`).join("; ")}.` : "No new listings matched your criteria in this period." },
  ];
  if (sub.includeInventory) sections.push({ heading: "Developer inventory", body: inv.length ? `${inv.filter((x) => x.change === "new").length} new releases, ${inv.filter((x) => x.change === "price_cut").length} price reductions and ${inv.filter((x) => x.change === "available").length} units back on sale within your budget.` : "No developer releases or price changes within your budget in this period." });
  sections.push({ heading: "What this means for you", body: signals.length ? signals.map((s) => s.text).join(" ") : "Conditions in the areas you follow are steady. Your adviser will contact you if a home that fits your brief comes to market before the next brief." });

  const firstRegion = [...byRegion.values()][0];
  const lastRow = firstRegion?.[firstRegion.length - 1];
  const content: ReportContent = {
    headline: lead,
    sections,
    metrics: [
      { label: "Matching listings", value: String(matching.length) },
      { label: "New this period", value: String(fresh.length) },
      { label: "Developer changes", value: String(inv.length) },
      { label: "Median asking", value: money(median(matching.map((l) => l.price))) },
      { label: lastRow ? `${lastRow.region} yield` : "Areas covered", value: lastRow ? `${lastRow.rentalYield.toFixed(1)}%` : String(areaStats.length) },
    ],
  };
  return {
    title,
    content,
    brief: { markets: f.markets, areas: f.areas, currency: cur, window: { from: since.toISOString(), to: now.toISOString() }, series, seriesLabel: "Median transacted price per sq ft (AED)", areaStats, listings: listingRows, inventory: inv.slice(0, 20), signals },
  };
}
