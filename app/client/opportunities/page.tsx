import Link from "next/link";
import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { RequestReview } from "@/components/composites/request-review";
import { PropertyCard } from "@/components/portal/property-card";
import { Term } from "@/components/portal/term";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { PROPERTY_STATUS_LABEL } from "@/lib/domain";
import { formatLocal } from "@/lib/format";
import { sceneFor } from "@/lib/media/subjects";
import { photosForProperties } from "@/lib/media/unsplash";
import { getPortfolio, listProperties } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

const STAGES = [
  { key: "all", label: "Everything" },
  { key: "ready", label: "Ready to move in" },
  { key: "building", label: "Being built" },
] as const;
const SORTS = [
  { key: "yield", label: "Highest yield" },
  { key: "price", label: "Lowest price" },
  { key: "developer", label: "Strongest developer" },
] as const;

type Params = { q?: string; stage?: string; city?: string; sort?: string };

function href(cur: Params, patch: Partial<Params>) {
  const next = { ...cur, ...patch };
  const qs = new URLSearchParams(Object.entries(next).filter(([k, v]) => v && !(k === "stage" && v === "all") && !(k === "sort" && v === "yield")) as [string, string][]).toString();
  return `/client/opportunities${qs ? `?${qs}` : ""}`;
}

export default async function OpportunitiesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const params = await searchParams;
  const { q, stage = "all", city, sort = "yield" } = params;
  const db = await getDb();
  const all = await listProperties(db, user.tenantId, { q });
  let markets: string[] = ["UAE", "India"];
  let held = new Set<string>();
  if (user.clientId) {
    const p = await getPortfolio(db, user, user.clientId);
    markets = p.client.policy.markets;
    held = new Set(p.holdings.map((h) => h.propertyId));
  }
  const eligible = all.filter((p) => markets.includes(p.market) && !held.has(p.id));
  const cities = [...new Set(eligible.map((p) => p.city))].sort();
  const lots = eligible
    .filter((p) => (stage === "ready" ? p.status === "ready" : stage === "building" ? p.status !== "ready" : true))
    .filter((p) => !city || p.city === city)
    .sort((a, b) => (sort === "price" ? a.priceMin - b.priceMin : sort === "developer" ? a.developerRisk - b.developerRisk : b.grossYield - a.grossYield));
  const media = await photosForProperties(lots.map((p) => ({ seed: p.slug, city: p.city, community: p.community, kind: p.assetClass })));

  return (
    <PageContainer>
      <PageHeader eyebrow="Screened against your investment policy" title="Opportunities" subtitle={`${lots.length} of ${eligible.length} projects in ${markets.join(" and ")} that you do not already hold.${q ? ` Filtered by “${q}”.` : ""}`} />

      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Stage" className="flex flex-wrap gap-2">
          {STAGES.map((s) => (
            <Link key={s.key} href={href(params, { stage: s.key })} aria-current={stage === s.key ? "page" : undefined} className={cn("rounded-full border px-3.5 py-1.5 text-meta font-medium transition-[background-color,border-color,color] duration-150", stage === s.key ? "border-coral-500 bg-coral-500 text-white" : "border-hairline bg-surface text-ink-700 hover:border-coral-500 hover:text-coral-700")}>
              {s.label}
            </Link>
          ))}
          {cities.length > 1 &&
            cities.map((c) => (
              <Link key={c} href={href(params, { city: city === c ? undefined : c })} aria-current={city === c ? "page" : undefined} className={cn("rounded-full border px-3.5 py-1.5 text-meta font-medium transition-[background-color,border-color,color] duration-150", city === c ? "border-sea-600 bg-sea-600 text-white" : "border-hairline bg-surface text-ink-700 hover:border-sea-600 hover:text-sea-700")}>
                {c}
              </Link>
            ))}
        </nav>
        <nav aria-label="Sort" className="flex items-center gap-1 rounded-full border border-hairline bg-surface p-1">
          {SORTS.map((s) => (
            <Link key={s.key} href={href(params, { sort: s.key })} aria-current={sort === s.key ? "page" : undefined} className={cn("rounded-full px-3 py-1 text-meta transition-[background-color,color] duration-150", sort === s.key ? "bg-ink-900 font-medium text-white" : "text-ink-500 hover:text-ink-900")}>
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      {lots.length === 0 ? (
        <div className="mt-8">
          <EmptyState glyph="opportunities" headline="No opportunities match these filters" note="Nothing on file fits this combination. Clear a filter, or ask your adviser to screen new launches for you." primary={{ label: "Show everything", href: "/client/opportunities" }} secondary={{ label: "Message your adviser", href: "/client/messages" }} />
        </div>
      ) : (
        <>
          <p className="mt-6 text-meta text-ink-500">
            Figures are asking prices. <Term k="grossYield" /> is before service charges; <Term k="handover" /> dates are the developer&apos;s.
          </p>
          <ul className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {lots.map((p, i) => (
              <li key={p.id} id={p.slug} className="scroll-mt-20">
                <PropertyCard
                  seed={p.slug}
                  media={media.get(p.slug) ?? { photo: null, scene: sceneFor(p.city) }}
                  ownSrc={p.imageUrl}
                  href={`/client/assistant?q=${encodeURIComponent(`Tell me about ${p.name} in ${p.community}`)}`}
                  title={p.name}
                  place={`${p.community}, ${p.city}`}
                  priority={i < 3}
                  ribbon={p.status === "ready" ? { label: "Ready to move in", tone: "mint" } : { label: `${PROPERTY_STATUS_LABEL[p.status] ?? p.status} · ${p.handover}`, tone: "iris" }}
                  stats={[
                    { label: "From", value: formatLocal(p.priceMin, p.currency) },
                    { label: "Per sq ft", value: Math.round(p.pricePerSqft).toLocaleString("en-US") },
                    { label: "Gross yield", value: `${p.grossYield.toFixed(1)}%`, tone: "sun" },
                  ]}
                  footer={
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate">
                        {p.developerName}
                        <span className={cn("ms-2 inline-block size-1.5 rounded-full align-middle", p.developerRisk < 30 ? "bg-mint-500" : p.developerRisk < 55 ? "bg-sun-500" : "bg-coral-500")} aria-label={`Developer risk ${Math.round(p.developerRisk)} of 100`} />
                      </span>
                      <span className="w-[150px] shrink-0">
                        <RequestReview propertyName={p.name} />
                      </span>
                    </div>
                  }
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </PageContainer>
  );
}
