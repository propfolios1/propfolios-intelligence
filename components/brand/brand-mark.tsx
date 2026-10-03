"use client";

import { useTenant } from "@/components/tenant-provider";
import { cn } from "@/lib/utils";

/**
 * Tenant wordmark. With a logo URL the logo is shown; otherwise the brand name
 * is set as a typographic wordmark: the first word in Inter 600 with wide
 * tracking, an accent hairline, the rest in the widest tracking beneath.
 */
export function BrandMark({ className, inverted = false, size = "md", name }: { className?: string; inverted?: boolean; size?: "sm" | "md" | "lg"; name?: string }) {
  const tenant = useTenant();
  const brand = name ?? tenant.config.brand_name;
  const width = size === "lg" ? 196 : size === "sm" ? 124 : 152;
  if (!name && tenant.config.logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tenant.config.logo_url} alt={brand} style={{ maxWidth: width, height: (width / 200) * 44 }} className={cn("block object-contain object-left", className)} />;
  }
  const [first, ...rest] = brand.trim().split(/\s+/);
  const top = (first ?? brand).toUpperCase();
  const bottom = rest.join(" ").toUpperCase();
  const ink = inverted ? "var(--surface)" : "var(--navy-900)";
  const sub = inverted ? "color-mix(in oklab, var(--surface) 70%, transparent)" : "var(--ink-500)";
  const topSize = top.length > 12 ? 13 : 17;
  return (
    <svg viewBox="0 0 200 44" width={width} height={(width / 200) * 44} role="img" aria-label={brand} direction="ltr" className={cn("block shrink-0", className)}>
      <text x="0" y="16" fill={ink} style={{ fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 600, fontSize: topSize, letterSpacing: "0.2em" }}>
        {top}
      </text>
      <rect x="0" y="24" width={bottom ? 168 : 120} height="1" fill="var(--gold-500)" />
      {bottom && (
        <text x="0" y="40" fill={sub} style={{ fontFamily: "var(--font-inter), Inter, sans-serif", fontWeight: 400, fontSize: bottom.length > 16 ? 7 : 8.5, letterSpacing: bottom.length > 16 ? "0.3em" : "0.55em" }}>
          {bottom}
        </text>
      )}
    </svg>
  );
}
