import { AllocationBar } from "@/components/charts/allocation-bar";
import { AreaSeries } from "@/components/charts/series";
import { PortfolioHero } from "@/components/composites/portfolio-hero";
import { SeverityPill } from "@/components/composites/status";
import { HoldingsTable } from "@/components/composites/tables/holdings-table";
import { PageContainer } from "@/components/shell/page-container";
import { DEMO_CLIENT_ID, getClient, getProperty, holdings, portfolioAlerts } from "@/lib/data/store";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Portfolio" };

export default function PortfolioPage() {
  const client = getClient(DEMO_CLIENT_ID)!;
  const hs = holdings.filter((h) => h.clientId === DEMO_CLIENT_ID);
  const value = hs.reduce((s, h) => s + h.valueUsd, 0);
  const cost = hs.reduce((s, h) => s + h.costUsd, 0);
  const irr = hs.reduce((s, h) => s + h.irr * h.valueUsd, 0) / value;
  const yld = hs.reduce((s, h) => s + h.cashYield * h.valueUsd, 0) / value;

  const nav = Array.from({ length: 12 }, (_, i) => {
    const q = 11 - i;
    const d = new Date();
    d.setMonth(d.getMonth() - q * 3);
    return { quarter: `Q${Math.floor(d.getMonth() / 3) + 1} ’${String(d.getFullYear()).slice(2)}`, value: Math.round(value / Math.pow(1.021, q) - Math.sin(i) * value * 0.008) };
  });

  const byRegion = new Map<string, number>();
  hs.forEach((h) => {
    const p = getProperty(h.propertyId)!;
    const key = p.market === "India" ? p.community.split(",").at(-1)!.trim() : p.region;
    byRegion.set(key, (byRegion.get(key) ?? 0) + h.valueUsd);
  });

  const alerts = portfolioAlerts.filter((a) => a.clientId === DEMO_CLIENT_ID);

  return (
    <PageContainer>
      <div className="eyebrow mb-10">{client.name}</div>
      <PortfolioHero valueUsd={value} costUsd={cost} qoq={4.6} irr={irr} cashYield={yld} />

      <div className="mt-16 grid grid-cols-1 gap-16 xl:grid-cols-12 xl:gap-6">
        <div className="min-w-0 xl:col-span-8">
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-section text-navy">Value over time</h2>
              <span className="text-small text-ink-3">USD, quarter end</span>
            </div>
            <div className="mt-8">
              <AreaSeries data={nav} x="quarter" y="value" name="Portfolio value" format="usd" height={260} />
            </div>
          </section>

          <section className="mt-16">
            <h2 className="font-display text-section text-navy">Allocation</h2>
            <div className="mt-8">
              <AllocationBar items={[...byRegion].map(([label, v]) => ({ label, value: v }))} />
            </div>
          </section>
        </div>

        <aside className="xl:col-span-4">
          <div className="flex items-baseline justify-between border-b border-ink pb-3">
            <h2 className="eyebrow">Alerts</h2>
            <span className="num text-small text-ink-3">{alerts.length}</span>
          </div>
          <ol>
            {alerts.map((a) => (
              <li key={a.id} className="border-b border-rule py-5">
                <div className="flex items-center justify-between gap-3">
                  <SeverityPill severity={a.severity} />
                  <time className="num text-axis text-ink-3">{relativeTime(a.at)}</time>
                </div>
                <h3 className="mt-3 text-ui font-medium text-ink">{a.title}</h3>
                <p className="mt-1 text-small text-ink-2">{a.detail}</p>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <section className="mt-20">
        <div className="mb-6 flex items-baseline justify-between">
          <h2 className="font-display text-section text-navy">Holdings</h2>
          <span className="num text-small text-ink-3">{hs.length}</span>
        </div>
        <HoldingsTable
          rows={hs.map((h) => {
            const p = getProperty(h.propertyId)!;
            return { id: h.id, propertyId: p.id, property: p.name, community: p.community, assetClass: p.assetClass, costUsd: h.costUsd, valueUsd: h.valueUsd, irr: h.irr, cashYield: h.cashYield, status: h.status };
          })}
        />
      </section>
    </PageContainer>
  );
}
