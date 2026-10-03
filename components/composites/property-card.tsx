import Link from "next/link";
import { BuildingGlyph } from "@/components/illustrations/building-glyph";
import { formatLocal, PROPERTY_STATUS_LABEL } from "@/lib/domain";
import { cn } from "@/lib/utils";

export interface PropertyCardData {
  slug: string;
  name: string;
  community: string;
  city: string;
  market: string;
  status: string;
  handover: string;
  currency: string;
  priceMin: number;
  pricePerSqft: number;
  grossYield: number;
  developerName: string;
  developerRisk?: number;
  assetClass?: string;
}

export function PropertyCard({ p, href, className, action }: { p: PropertyCardData; href: string; className?: string; action?: React.ReactNode }) {
  return (
    <article className={cn("group relative flex flex-col rounded-md border border-hairline bg-surface shadow-card transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-ink-400", className)}>
      <div className="flex h-28 items-end justify-between overflow-hidden rounded-t-md border-b border-hairline bg-navy-50 px-5">
        <BuildingGlyph seed={p.slug} assetClass={p.assetClass ?? "Residential"} size={64} framed={false} className="text-navy-700" />
        <span className="mb-3 rounded-full bg-surface px-2.5 py-0.5 text-axis font-medium text-ink-700">{PROPERTY_STATUS_LABEL[p.status] ?? p.status}</span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="eyebrow">
          {p.community}, {p.city}
        </div>
        <h3 className="mt-1.5 font-display text-read text-navy-900">
          <Link href={href} className="after:absolute after:inset-0">
            {p.name}
          </Link>
        </h3>
        <p className="mt-0.5 text-small text-ink-500">
          {p.developerName} · {p.handover}
        </p>
        <dl className="mt-auto grid grid-cols-3 gap-3 border-t border-hairline pt-4">
          <div>
            <dt className="text-axis text-ink-500">From</dt>
            <dd className="num text-small text-ink-900">{formatLocal(p.priceMin, p.currency)}</dd>
          </div>
          <div>
            <dt className="text-axis text-ink-500">Per sq ft</dt>
            <dd className="num text-small text-ink-900">{Math.round(p.pricePerSqft).toLocaleString("en-US")}</dd>
          </div>
          <div>
            <dt className="text-axis text-ink-500">Gross yield</dt>
            <dd className="num text-small text-ink-900">{p.grossYield.toFixed(1)}%</dd>
          </div>
        </dl>
        {action && <div className="relative z-10 mt-4">{action}</div>}
      </div>
    </article>
  );
}
