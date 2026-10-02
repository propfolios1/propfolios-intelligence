import { BarSeries, LineSeries } from "@/components/charts/series";
import { MarketTiming } from "@/components/composites/market-timing";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { getMarket } from "@/lib/queries";

export const metadata = { title: "Market" };
export const dynamic = "force-dynamic";

export default async function MarketPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const regions = await getMarket(await getDb(), user.tenantId);
  const dubai = regions.find((r) => r.region === "Dubai") ?? regions[0]!;
  const months = dubai.series.map((m) => m.month.slice(0, 7));
  const indexed = months.map((month, i) => {
    const row: Record<string, string | number> = { month };
    for (const r of regions) {
      const base = r.series[0]!.medianPriceSqft;
      row[r.region] = +((r.series[i]!.medianPriceSqft / base) * 100).toFixed(1);
    }
    return row;
  });
  const last = dubai.latest;
  return (
    <PageContainer>
      <PageHeader eyebrow="Market intelligence" title="Market" subtitle="Twelve months of residential transactions, pricing, supply and absorption for the four principal emirates. Sources: DLD, ADREC and municipal registers." />
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {regions.map((r) => (
          <StatCard key={r.region} label={r.region} value={Math.round(r.latest.medianPriceSqft).toLocaleString("en-US")} unit="AED / sq ft" delta={r.priceChangePct} deltaLabel="12 months" spark={r.series.map((m) => m.medianPriceSqft)} />
        ))}
      </section>
      <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader eyebrow="Indexed to 100 twelve months ago" title="Price per sq ft" />
          <CardContent>
            <LineSeries data={indexed} x="month" series={regions.slice(0, 2).map((r) => ({ key: r.region, label: r.region }))} height={300} format="number" grid />
          </CardContent>
        </Card>
        <Card className="xl:col-span-4">
          <CardHeader eyebrow="Agent" title="Market timing" />
          <CardContent>
            <MarketTiming regions={regions.map((r) => r.region)} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-6">
          <CardHeader eyebrow="Dubai, monthly" title="Transactions" actions={<span className="num text-small text-ink-500">{last.transactions.toLocaleString("en-US")} latest</span>} />
          <CardContent>
            <BarSeries data={dubai.series.map((m) => ({ month: m.month.slice(0, 7), tx: m.transactions }))} x="month" y="tx" name="Transactions" height={220} emphasiseLast format="number" />
          </CardContent>
        </Card>
        <Card className="xl:col-span-6">
          <CardHeader eyebrow="Dubai, monthly" title="Supply handed over" />
          <CardContent>
            <BarSeries data={dubai.series.map((m) => ({ month: m.month.slice(0, 7), units: m.supplyUnits }))} x="month" y="units" name="Units" height={220} format="number" />
          </CardContent>
        </Card>
      </section>
      <section className="mt-8">
        <Table>
          <THead>
            <TR>
              <TH>Emirate</TH>
              <TH numeric>Transactions</TH>
              <TH numeric>Median AED / sq ft</TH>
              <TH numeric>12-month change</TH>
              <TH numeric>Off-plan share</TH>
              <TH numeric>Gross yield</TH>
              <TH numeric>Absorption</TH>
            </TR>
          </THead>
          <tbody>
            {regions.map((r) => (
              <TR key={r.region}>
                <TD className="font-medium">{r.region}</TD>
                <TD numeric>{r.latest.transactions.toLocaleString("en-US")}</TD>
                <TD numeric>{Math.round(r.latest.medianPriceSqft).toLocaleString("en-US")}</TD>
                <TD numeric className="text-success">+{r.priceChangePct.toFixed(1)}%</TD>
                <TD numeric>{r.latest.offPlanShare.toFixed(1)}%</TD>
                <TD numeric>{r.latest.rentalYield.toFixed(1)}%</TD>
                <TD numeric>{r.latest.absorptionRate.toFixed(0)}%</TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </section>
    </PageContainer>
  );
}
