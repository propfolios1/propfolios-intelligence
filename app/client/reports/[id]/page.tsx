import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/composites/page-header";
import { LineSeries } from "@/components/charts/series";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { clientReport, markViewed } from "@/lib/market-intel/service";
import { cn, formatDate, formatMoney } from "@/lib/utils";

export const metadata = { title: "Report" };
export const dynamic = "force-dynamic";

const KIND = { annual: "Annual review", quarterly: "Quarterly report", ad_hoc: "Portfolio report", market_brief: "Market brief" } as const;
const CHANGE = { new: "New release", price_cut: "Price reduced", price_rise: "Price increased", available: "Back on sale" } as const;
const TONE = { positive: "border-l-success", neutral: "border-l-navy-700", caution: "border-l-warning" } as const;

export default async function ReportDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  if (!user.clientId) notFound();
  const db = await getDb();
  const r = await clientReport(db, user.tenantId, user.clientId, id);
  if (!r) notFound();
  if (user.role === "client") await markViewed(db, r.id);
  const b = r.brief;
  const regions = b ? [...new Set(b.series.flatMap((row) => Object.keys(row).filter((k) => k !== "month")))] : [];
  return (
    <PageContainer>
      <PageHeader
        eyebrow={`${KIND[r.type]} · ${formatDate(r.generatedAt, "long")}`}
        title={r.title}
        actions={
          <Button asChild variant="secondary">
            <Link href={r.type === "market_brief" ? "/client/subscriptions" : "/client/reports"}>{r.type === "market_brief" ? "Manage subscriptions" : "All reports"}</Link>
          </Button>
        }
      />
      <article className="mt-8 rounded-md border border-hairline bg-surface p-6 md:p-10">
        <p className="max-w-[70ch] font-display text-[22px] leading-snug text-navy-900">{r.content.headline}</p>
        <dl className="mt-6 grid grid-cols-2 gap-4 border-y border-hairline py-4 sm:grid-cols-5">
          {r.content.metrics.map((m) => (
            <div key={m.label}>
              <dt className="eyebrow">{m.label}</dt>
              <dd className="num mt-1 text-read text-navy-900">{m.value}</dd>
            </div>
          ))}
        </dl>
        {b && b.signals.length > 0 && (
          <ul className="mt-6 grid gap-2">
            {b.signals.map((s) => (
              <li key={s.text} className={cn("border-l-2 bg-ink-50 px-4 py-2 text-small text-ink-900", TONE[s.tone])}>
                {s.text}
              </li>
            ))}
          </ul>
        )}
        {b && b.series.length > 1 && (
          <section className="mt-8">
            <h2 className="eyebrow mb-3">{b.seriesLabel}</h2>
            <LineSeries data={b.series} x="month" series={regions.map((k) => ({ key: k, label: k }))} height={240} format="number" />
          </section>
        )}
        <div className="prose-pf mt-8 max-w-[70ch]">
          {r.content.sections.map((x) => (
            <section key={x.heading}>
              <h3>{x.heading}</h3>
              <p>{x.body}</p>
            </section>
          ))}
        </div>
      </article>

      {b && b.areaStats.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-section text-navy-900">Asking prices by area</h2>
          <div className="mt-4 overflow-x-auto rounded-md border border-hairline bg-surface">
            <table className="w-full min-w-[560px] text-small">
              <thead className="border-b border-hairline text-left">
                <tr className="eyebrow">
                  <th className="px-4 py-3 font-medium">Area</th>
                  <th className="px-4 py-3 text-right font-medium">Listings</th>
                  <th className="px-4 py-3 text-right font-medium">Median price</th>
                  <th className="px-4 py-3 text-right font-medium">Per sq ft</th>
                  <th className="px-4 py-3 text-right font-medium">New vs existing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {b.areaStats.map((a) => (
                  <tr key={`${a.market}${a.area}`}>
                    <td className="px-4 py-3 text-ink-900">{a.area}</td>
                    <td className="num px-4 py-3 text-right">{a.listings}</td>
                    <td className="num px-4 py-3 text-right">{a.medianPrice !== null ? formatMoney(a.medianPrice, b.currency) : "n/a"}</td>
                    <td className="num px-4 py-3 text-right">{a.medianPpsf !== null ? formatMoney(Math.round(a.medianPpsf), b.currency) : "n/a"}</td>
                    <td className={cn("num px-4 py-3 text-right", a.changePct === null ? "text-ink-400" : a.changePct >= 0 ? "text-ink-900" : "text-success")}>{a.changePct === null ? "n/a" : `${a.changePct >= 0 ? "+" : ""}${a.changePct.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {b && b.listings.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-section text-navy-900">Homes that match</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {b.listings.map((l) => (
              <li key={l.id} className="rounded-md border border-hairline bg-surface p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="eyebrow">
                    {l.community}, {l.city}
                  </span>
                  {l.isNew && <span className="rounded-full border border-gold-500 px-2 text-[11px] text-gold-600">New</span>}
                </div>
                <div className="mt-1 text-ui text-ink-900">{l.title}</div>
                <div className="num mt-2 flex justify-between text-small text-ink-700">
                  <span>{formatMoney(l.price, l.currency)}</span>
                  <span>
                    {l.bedrooms === null ? "" : l.bedrooms === 0 ? "Studio" : `${l.bedrooms} bed`} · {l.reference}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-500">Ask your adviser about any of these homes from Messages, quoting the reference.</p>
        </section>
      )}

      {b && b.inventory.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-section text-navy-900">Developer releases and price changes</h2>
          <div className="mt-4 overflow-x-auto rounded-md border border-hairline bg-surface">
            <table className="w-full min-w-[640px] text-small">
              <thead className="border-b border-hairline text-left">
                <tr className="eyebrow">
                  <th className="px-4 py-3 font-medium">Change</th>
                  <th className="px-4 py-3 font-medium">Project</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 text-right font-medium">Bedrooms</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {b.inventory.map((u) => (
                  <tr key={`${u.project}${u.unitRef}`}>
                    <td className={cn("px-4 py-3", u.change === "price_cut" ? "text-success" : "text-ink-700")}>{CHANGE[u.change]}</td>
                    <td className="px-4 py-3 text-ink-900">
                      {u.project}
                      <div className="text-[12px] text-ink-500">{u.developer}</div>
                    </td>
                    <td className="num px-4 py-3">{u.unitRef}</td>
                    <td className="num px-4 py-3 text-right">{u.bedrooms === null ? "n/a" : u.bedrooms === 0 ? "Studio" : u.bedrooms}</td>
                    <td className="num px-4 py-3 text-right">
                      {u.price !== null ? formatMoney(u.price, u.currency) : "On request"}
                      {u.previousPrice !== null && <div className="text-[12px] text-ink-400 line-through">{formatMoney(u.previousPrice, u.currency)}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {b && <p className="mt-8 max-w-[70ch] text-[12px] text-ink-500">Covers {formatDate(b.window.from, "long")} to {formatDate(b.window.to, "long")}. Compiled from your advisers&rsquo; market statistics, the firm&rsquo;s live listings and the developer price lists it receives. Information only, not investment advice.</p>}
    </PageContainer>
  );
}
