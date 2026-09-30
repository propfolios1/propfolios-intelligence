import Link from "next/link";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { getAnalysis, getDeveloper, listMandates, properties } from "@/lib/data/store";
import { formatMoney, initials } from "@/lib/utils";

export const metadata = { title: "Opportunities" };

export default function OpportunitiesPage() {
  const mandates = listMandates();
  const curated = properties.slice(8, 20).map((p) => {
    const m = mandates.find((x) => x.propertyId === p.id);
    const a = m ? getAnalysis(m.id) : undefined;
    const irr = a ? [a.underwriting.scenarios[0]!.irr, a.underwriting.scenarios[2]!.irr] : [p.grossYield + 1.5, p.grossYield + 6.2];
    return { p, m, irr };
  });

  return (
    <PageContainer>
      <PageHeader eyebrow="Curated for you" title="Opportunities" subtitle="Screened by our analysts against your mandate. Each has a full investment memo." />
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {curated.map(({ p, m, irr }) => (
          <article key={p.id} className="group flex flex-col overflow-hidden rounded-card border border-ink-200 bg-surface transition-[transform,border-color] duration-250 ease-brand hover:-translate-y-px hover:border-ink-300">
            <div
              className="relative flex h-44 items-end p-6"
              style={{ background: `linear-gradient(140deg, hsl(${p.hue} 55% 14%), hsl(${p.hue} 38% 30%))` }}
              aria-hidden
            >
              <span className="absolute top-5 right-6 font-display text-[64px] leading-none text-white/10">{initials(p.name)}</span>
              <span className="h-px w-10 bg-gold-500" />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center gap-2">
                <Pill tone="outline">{p.assetClass}</Pill>
                <Pill tone={p.status === "Ready" ? "positive" : "navy"}>{p.status}</Pill>
              </div>
              <h3 className="mt-4 font-display text-card font-medium text-navy-900">{p.name}</h3>
              <p className="mt-1 text-secondary text-ink-500">
                {getDeveloper(p.developerId)!.name} · {p.community}
              </p>
              <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-200 pt-5">
                <div>
                  <dt className="eyebrow">Price range</dt>
                  <dd className="num mt-1 text-sm text-ink-900">
                    {formatMoney(p.priceMin, p.currency)} – {formatMoney(p.priceMax, p.currency).split(" ")[1]}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">IRR range</dt>
                  <dd className="num mt-1 text-sm text-ink-900">
                    {irr[0]!.toFixed(1)}–{irr[1]!.toFixed(1)}%
                  </dd>
                </div>
              </dl>
              <div className="mt-6 flex-1" />
              <Button asChild variant="secondary" className="w-full">
                <Link href={m ? `/analyst/mandates/${m.id}?tab=memo` : "/client/assistant"}>View Memo</Link>
              </Button>
            </div>
          </article>
        ))}
      </div>
    </PageContainer>
  );
}
