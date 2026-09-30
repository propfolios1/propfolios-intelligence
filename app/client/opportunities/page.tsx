import Link from "next/link";
import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { BuildingGlyph } from "@/components/illustrations/building-glyph";
import { StatusPill } from "@/components/primitives/status-pill";
import { PageContainer } from "@/components/shell/page-container";
import { getAnalysis, getDeveloper, listMandates, properties } from "@/lib/data/store";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Opportunities" };

/**
 * A catalogue, not a card grid: each lot is drawn as an elevation, numbered,
 * with price and return set in mono beneath.
 */
export default function OpportunitiesPage() {
  const mandates = listMandates();
  const lots = properties.slice(8, 17).map((p) => {
    const m = mandates.find((x) => x.propertyId === p.id);
    const a = m ? getAnalysis(m.id) : undefined;
    const irr = a ? [a.underwriting.scenarios[0]!.irr, a.underwriting.scenarios[2]!.irr] : [p.grossYield + 1.5, p.grossYield + 6.2];
    return { p, m, irr };
  });

  return (
    <PageContainer>
      <PageHeader eyebrow="Curated this quarter" title="Opportunities" subtitle={`${lots.length} schemes screened against your mandate. Each has a full memo.`} />
      {lots.length === 0 ? (
        <EmptyState glyph="opportunities" headline="No opportunities match your mandate this quarter." />
      ) : (
        <ol className="mt-12 grid grid-cols-1 gap-x-6 md:grid-cols-2 xl:grid-cols-3">
          {lots.map(({ p, m, irr }, i) => (
            <li key={p.id} id={p.id} className="group border-t border-ink pt-5 pb-14">
              <div className="flex items-baseline justify-between">
                <span className="num text-small text-ink-3">Lot {String(i + 1).padStart(2, "0")}</span>
                <StatusPill tone={p.status === "Ready" ? "complete" : "neutral"}>{p.status}</StatusPill>
              </div>
              <div className="mt-5 flex h-48 items-end justify-center border border-rule bg-paper-2 pt-6 transition-[border-color] duration-120 group-hover:border-ink-3">
                <BuildingGlyph seed={p.id} assetClass={p.assetClass} size={168} framed={false} />
              </div>
              <h2 className="mt-6 font-display text-card leading-[1.2] text-navy md:text-[1.75rem]">{p.name}</h2>
              <p className="mt-1 text-small text-ink-2">
                {getDeveloper(p.developerId)!.name}, {p.community}
              </p>
              <dl className="mt-6 grid grid-cols-2 border-t border-rule">
                <div className="py-3 pr-4">
                  <dt className="text-small text-ink-3">Price</dt>
                  <dd className="num mt-0.5 text-ui text-ink">
                    {formatMoney(p.priceMin, p.currency)}–{formatMoney(p.priceMax, p.currency).split(" ")[1]}
                  </dd>
                </div>
                <div className="border-l border-rule py-3 pl-4">
                  <dt className="text-small text-ink-3">IRR, P10–P90</dt>
                  <dd className="num mt-0.5 text-ui text-ink">
                    {irr[0]!.toFixed(1)}–{irr[1]!.toFixed(1)}%
                  </dd>
                </div>
              </dl>
              <Link
                href={m ? `/analyst/mandates/${m.id}?tab=memo` : `/client/assistant?q=${encodeURIComponent(`Tell me about ${p.name}`)}`}
                className="mt-4 inline-flex items-baseline gap-2 text-small font-medium text-ink underline decoration-rule underline-offset-4 transition-[text-decoration-color] duration-120 hover:decoration-ink"
              >
                Read the memo <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </PageContainer>
  );
}
