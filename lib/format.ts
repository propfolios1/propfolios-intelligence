/** Indian and multi-currency number formatting (lakh and crore), safe on server and client. */

const inGroup = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatInr(value: number, opts: { compact?: boolean } = {}) {
  const v = Math.round(value);
  if (opts.compact ?? Math.abs(v) >= 1_00_000) {
    if (Math.abs(v) >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(2)} Cr`;
    return `₹${(v / 1_00_000).toFixed(2)} L`;
  }
  return `₹${inGroup.format(v)}`;
}

export function formatLocal(value: number, currency: string, opts: { compact?: boolean } = {}) {
  if (currency === "INR") return formatInr(value, opts);
  const compact = opts.compact ?? Math.abs(value) >= 100_000;
  return `${currency} ${new Intl.NumberFormat("en-US", compact ? { notation: "compact", maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }).format(value)}`;
}

export const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;
