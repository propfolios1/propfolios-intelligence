import { Bars, Heatmap, MultiLine } from "@/components/charts";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { heatmap, heatmapClasses, heatmapRegions, marketMonths, priceTrend, supplyPipeline } from "@/lib/data/store";

export const metadata = { title: "Market" };

export default function MarketPage() {
  const last = marketMonths.at(-1)!;
  const prev = marketMonths.at(-2)!;
  const txTotal = marketMonths.reduce((s, m) => s + m.transactions, 0);
  return (
    <PageContainer>
      <PageHeader eyebrow="Market intelligence" title="Market" subtitle="Transactions, pricing and supply across tracked UAE and India markets. Refreshed weekly by the market-intel agent." />

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Transactions (12m)" value={(txTotal / 1000).toFixed(1)} unit="k" delta={21.4} deltaLabel="YoY" spark={marketMonths.map((m) => m.transactions)} />
        <StatCard
          label="Median price / sq ft"
          value={last.medianPriceSqft.toLocaleString()}
          unit="AED"
          delta={((last.medianPriceSqft - prev.medianPriceSqft) / prev.medianPriceSqft) * 100}
          deltaLabel="MoM"
          spark={marketMonths.map((m) => m.medianPriceSqft)}
        />
        <StatCard label="Supply pipeline ’27" value={(supplyPipeline[2]!.units / 1000).toFixed(1)} unit="k units" delta={34.6} deltaLabel="vs ’26" invertDelta />
        <StatCard label="Absorption rate" value="82" unit="%" delta={-3.1} deltaUnit="pp" deltaLabel="vs last quarter" spark={[88, 87, 86, 85, 84, 83, 82]} />
      </div>

      <Card className="mt-10">
        <CardHeader eyebrow="Pricing" title="Average price per sq ft, 24 months" />
        <CardBody>
          <MultiLine
            data={priceTrend}
            x="month"
            series={[
              { key: "dubai", label: "Dubai (AED)" },
              { key: "abuDhabi", label: "Abu Dhabi (AED)" },
              { key: "mumbai", label: "Mumbai (AED equiv.)" },
            ]}
            height={340}
            format="number"
          />
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Card>
          <CardHeader eyebrow="Volume" title="Transactions by month" />
          <CardBody>
            <Bars data={marketMonths} x="month" y="transactions" name="Transactions" height={300} highlightLast />
          </CardBody>
        </Card>
        <Card>
          <CardHeader eyebrow="Performance" title="YoY price change by market × asset class" />
          <CardBody>
            <Heatmap rows={heatmapRegions} cols={heatmapClasses} values={heatmap} />
          </CardBody>
        </Card>
      </div>
    </PageContainer>
  );
}
