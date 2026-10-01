import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Teach tailwind-merge the design system's type scale so `text-small` never evicts `text-surface`. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["hero", "title", "section", "card", "read", "body", "ui", "small", "eyebrow", "figure", "axis"] }],
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

export function formatDate(iso: string | Date, style: "short" | "long" | "time" | "datetime" = "short") {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  switch (style) {
    case "long":
      return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    case "time":
      return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    case "datetime":
      return `${d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} · ${d.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    default:
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
}

export function relativeTime(iso: string, now = Date.now()) {
  const diff = (now - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(iso);
}
