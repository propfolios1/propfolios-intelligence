import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Teach tailwind-merge the design system's type scale so `text-small` never evicts `text-surface`. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "title", "page-sm", "section", "card", "lead", "palette", "read", "body", "ui", "small", "meta", "axis", "eyebrow", "label", "hint", "mono", "figure", "figure-lg"] }],
      shadow: [{ shadow: ["card", "float", "modal", "palette", "toast", "drag"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Currency with compact suffix: AED 4.2M, USD 12.5K. */
export function formatMoney(value: number, currency = "AED", opts: { compact?: boolean } = {}) {
  const useCompact = opts.compact ?? Math.abs(value) >= 100_000;
  const body = useCompact ? compact.format(value) : integer.format(value);
  return `${currency} ${body}`;
}

export function formatNumber(value: number, digits = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatCompact(value: number) {
  return compact.format(value);
}

export function formatPct(value: number, digits = 1, signed = false) {
  const s = `${value.toFixed(digits)}%`;
  return signed && value > 0 ? `+${s}` : s;
}

export function formatUsdCost(value: number) {
  return `$${value.toFixed(value < 1 ? 3 : 2)}`;
}

/** ISO calendar date, YYYY-MM-DD, in the Gulf time zone: the one convention for tables, lists and metadata. */
export function isoDate(iso: string | Date) {
  const d = typeof iso === "string" ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso) : iso;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/**
 * Dates. "short" (the default, for tables and metadata) is YYYY-MM-DD;
 * "datetime" adds 24-hour time; "long" spells the date out for documents
 * and page eyebrows. Activity feeds use relativeTime instead.
 */
export function formatDate(iso: string | Date, style: "short" | "long" | "time" | "datetime" = "short") {
  const d = typeof iso === "string" ? new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso) : iso;
  const time = () => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  switch (style) {
    case "long":
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Dubai" });
    case "time":
      return time();
    case "datetime":
      return `${isoDate(d)} ${time()}`;
    default:
      return isoDate(d);
  }
}

export function relativeTime(iso: string, now = Date.now()) {
  const diff = (now - new Date(iso).getTime()) / 1000;
  if (diff <= -60) {
    const ahead = -diff;
    if (ahead < 3600) return `in ${Math.round(ahead / 60)}m`;
    if (ahead < 86400) return `in ${Math.round(ahead / 3600)}h`;
    if (ahead < 86400 * 7) return `in ${Math.round(ahead / 86400)}d`;
    return formatDate(iso);
  }
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(iso);
}
