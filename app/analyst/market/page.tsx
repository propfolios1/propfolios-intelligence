import { Heatmap } from "@/components/charts/heatmap";
import { BarSeries, LineSeries } from "@/components/charts/series";
import { PageHeader } from "@/components/composites/page-header";
import { StatBlock } from "@/components/composites/stat-block";
import { PageContainer } from "@/components/shell/page-container";
import { heatmap, heatmapClasses, heatmapRegions, marketMonths, priceTrend, supplyPipeline } from "@/lib/data/store";

export const metadata = { title: "Market" };

export default function MarketPage() {
  const last = marketMonths.at(-1)!;
  const prev = marketMonths.at(-2)!;
  const tx = marketMonths.reduce((s, m) => s + m.transactions, 0);
  return (
    <PageContainer>
      <PageHeader eyebrow="Market intelligence" title="Market" subtitle="Dubai and Abu Dhabi residential, 24 months. Refreshed each Monday from DLD and ADREC filings." />

      <section className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-12">
        <StatBlock className="col-span-2 md:col-span-4" emphasis label="Transactions, 12 months" value={tx.toLocaleString()} delta={21.4} deltaLabel="year on year" />
        <StatBlock className="md:col-span-3" label="Median AED / sq ft" value={last.medianPriceSqft.toLocaleString()} delta={((last.medianPriceSqft - prev.medianPriceSqft) / prev.medianPriceSqft) * 100} deltaLabel="month on month" />
        <StatBlock className="md:col-span-3" label="Supply 2027" value={(supplyPipeline[2]!.units / 1000).toFixed(1)} unit="k units" delta={34.6} invert deltaLabel="vs 2026" />
        <StatBlock className="col-span-2 md:col-span-2" label="Absorption" value="82" unit="%" delta={-3.1} deltaUnit="pp" deltaLabel="vs Q2" />
      </section>

      <section className="mt-20">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="font-display text-section text-navy">Price per square foot</h2>
          <span className="text-small text-ink-3">AED, monthly median</span>
        </div>
        <div className="mt-8">
          <LineSeries
            data={priceTrend}
            x="month"
            series={[
              { key: "dubai", label: "Dubai" },
              { key: "abuDhabi", label: "Abu Dhabi" },
            ]}
            height={360}
            format="number"
            grid
          />
        </div>
      </section>

      <section className="mt-20 grid grid-cols-1 gap-16 xl:grid-cols-12 xl:gap-6">
        <div className="xl:col-span-4">
          <h2 className="font-display text-section text-navy">Volume</h2>
          <p className="mt-2 text-small text-ink-3">Dubai transactions by month. September in navy.</p>
          <div className="mt-8">
            <BarSeries data={marketMonths} x="month" y="transactions" name="Transactions" height={300} emphasiseLast />
          </div>
        </div>
        <div className="xl:col-span-7 xl:col-start-6">
          <h2 className="font-display text-section text-navy">Where prices moved</h2>
          <p className="mt-2 text-small text-ink-3">Year on year change, percent. Darker is stronger.</p>
          <div className="mt-8">
            <Heatmap rows={heatmapRegions} cols={heatmapClasses} values={heatmap} />
          </div>
        </div>
      </section>
    </PageContainer>
  );
}
