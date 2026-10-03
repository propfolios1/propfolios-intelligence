import Link from "next/link";
import { notFound } from "next/navigation";
import { LineSeries } from "@/components/charts/series";
import { Metric, MetricGrid } from "@/components/composites/metric";
import { PageHeader } from "@/components/composites/page-header";
import { StagePill } from "@/components/composites/status";
import { BuildingGlyph } from "@/components/illustrations/building-glyph";
import { Crumb } from "@/components/shell/crumb";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { getDb } from "@/db";
import { HttpError, requireRole } from "@/lib/auth";
import { formatLocal, PROPERTY_STATUS_LABEL } from "@/lib/domain";
import { similarProperties } from "@/lib/ai/similar";
import { getProperty } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function load(id: string) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  try {
    const db = await getDb();
    const d = await getProperty(db, user, id);
    return { ...d, peers: await similarProperties(db, user.tenantId, d.property.id, 10) };
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await load(id);
  return { title: d.property.name };
}

const BREAKDOWN_LABEL: Record<string, string> = { delivery: "Delivery", financial: "Financial health", litigation: "Litigation", sentiment: "Sentiment", escrow: "Escrow" };

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { property: p, developer: d, transactions, launches, mandates, market, peers } = await load(id);
  const own = transactions.filter((t) => t.propertyId === p.id);
  const comps = transactions.filter((t) => t.propertyId !== p.id);
  const median = (xs: number[]) => (xs.length ? [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]! : 0);
  const compMedian = median(comps.map((t) => t.pricePerSqft));
  const premium = compMedian ? ((p.pricePerSqft - compMedian) / compMedian) * 100 : null;

  return (
    <PageContainer>
      <Crumb segment={id} label={p.name} />
      <PageHeader
        eyebrow={`${p.community}, ${p.city} · ${p.market}`}
        title={p.name}
        subtitle={p.description}
        actions={
          <Button asChild>
            <Link href={`/analyst/mandates/new?property=${p.id}`}>Create mandate</Link>
          </Button>
        }
        meta={
          <>
            <StatusPill tone={p.status === "ready" ? "complete" : "progress"}>{PROPERTY_STATUS_LABEL[p.status]}</StatusPill>
            <span>{d.name}</span>
            <span className="num">{p.reraNumber}</span>
            <span>Handover {p.handover}</span>
          </>
        }
      />
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <Card>
            <CardHeader eyebrow="Catalogue" title="Key facts" />
            <CardContent>
              <MetricGrid>
                <Metric label="Price range" value={`${formatLocal(p.priceMin, p.currency)} to ${formatLocal(p.priceMax, p.currency)}`} />
                <Metric label="Price per sq ft" value={`${p.currency} ${Math.round(p.pricePerSqft).toLocaleString("en-US")}`} sub={premium !== null ? `${premium >= 0 ? "+" : ""}${premium.toFixed(1)}% vs comparables` : undefined} />
                <Metric label="Gross yield" value={`${p.grossYield.toFixed(1)}%`} />
                <Metric label="Units" value={p.units.toLocaleString("en-US")} />
                <Metric label="Asset class" value={p.assetClass} />
                <Metric label="Payment plan" value={p.paymentPlan ?? "Ready, full payment"} size="sm" />
              </MetricGrid>
            </CardContent>
          </Card>
          {market.length > 1 && (
            <Card>
              <CardHeader eyebrow={`${p.region}, twelve months`} title="Median price per sq ft" />
              <CardContent>
                <LineSeries data={market.map((m) => ({ month: m.month.slice(0, 7), psf: m.medianPriceSqft }))} x="month" series={[{ key: "psf", label: "Median AED per sq ft" }]} height={220} format="number" />
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader eyebrow="pgvector, nearest by profile" title="Comparable projects" actions={<span className="num text-small text-ink-500">{peers.length} of {peers.length}</span>} />
            <CardContent>
              {peers.length === 0 ? (
                <p className="text-small text-ink-500">No profile embedding for this project yet.</p>
              ) : (
                <ol className="divide-y divide-hairline">
                  {peers.map((x, i) => (
                    <li key={x.propertyId} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3">
                      <span className="num text-small text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                      <Link href={`/analyst/properties/${x.slug}`} className="min-w-0 hover:underline">
                        <span className="block truncate text-ui text-ink-900">{x.name}</span>
                        <span className="block truncate text-small text-ink-500">
                          {x.community}, {x.city} · {x.developer}
                        </span>
                      </Link>
                      <span className="text-right">
                        <span className="num block text-small text-ink-900">
                          {x.currency} {Math.round(x.pricePerSqft).toLocaleString("en-US")} · {x.grossYield.toFixed(1)}%
                        </span>
                        <span className="mt-1 flex items-center justify-end gap-2">
                          <span className="h-1 w-16 rounded-full bg-ink-100" aria-hidden>
                            <span className="block h-1 rounded-full bg-navy-700" style={{ width: `${Math.round(x.similarity * 100)}%` }} />
                          </span>
                          <span className="num text-axis text-ink-500">{Math.round(x.similarity * 100)}%</span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader eyebrow={`${comps.length + own.length} registered transactions`} title="Comparable transactions" actions={compMedian ? <span className="num text-small text-ink-500">Median {p.currency} {Math.round(compMedian).toLocaleString("en-US")}</span> : undefined} />
            <CardContent className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Date</TH>
                    <TH>Community</TH>
                    <TH>Type</TH>
                    <TH className="text-right">Area</TH>
                    <TH className="text-right">Per sq ft</TH>
                    <TH className="text-right">Price</TH>
                  </TR>
                </THead>
                <tbody>
                  {transactions.slice(0, 15).map((t) => (
                    <TR key={t.id}>
                      <TD className="num">{formatDate(t.transactedAt)}</TD>
                      <TD>
                        {t.community}
                        {t.propertyId === p.id && <span className="ml-2 text-small text-gold-600">Subject</span>}
                      </TD>
                      <TD className="text-ink-700">
                        {t.bedrooms ? `${t.bedrooms} bed ` : ""}
                        {t.assetType} · {t.kind.replace("_", "-")}
                      </TD>
                      <TD className="num text-right">{Math.round(t.areaSqft).toLocaleString("en-US")}</TD>
                      <TD className="num text-right">{Math.round(t.pricePerSqft).toLocaleString("en-US")}</TD>
                      <TD className="num text-right">{formatLocal(t.price, p.currency)}</TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
              {transactions.length === 0 && <p className="py-6 text-small text-ink-500">No registered transactions on record.</p>}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card className="overflow-hidden">
            <div className="flex h-40 items-end justify-center bg-navy-50">
              <BuildingGlyph seed={p.slug} assetClass={p.assetClass} size={120} framed={false} className="text-navy-700" />
            </div>
          </Card>
          <Card>
            <CardHeader eyebrow="Developer" title={d.name} actions={<span className="num text-small text-ink-500">Risk {d.riskScore.toFixed(1)}</span>} />
            <CardContent>
              <p className="text-small text-ink-700">{d.summary}</p>
              <dl className="mt-4 flex flex-col gap-3">
                {Object.entries(d.riskBreakdown).map(([k, v]) => (
                  <div key={k}>
                    <div className="flex justify-between text-small">
                      <dt className="text-ink-700">{BREAKDOWN_LABEL[k] ?? k}</dt>
                      <dd className="num text-ink-900">{Number(v).toFixed(0)}</dd>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-ink-100">
                      <div className="h-1 rounded-full bg-navy-700" style={{ width: `${Math.min(100, Number(v))}%` }} />
                    </div>
                  </div>
                ))}
              </dl>
              <Link href="/analyst/developers" className="mt-4 inline-block text-small text-ink-700 hover:text-ink-900">
                All developers
              </Link>
            </CardContent>
          </Card>
          {launches.length > 0 && (
            <Card>
              <CardHeader eyebrow="Launches" title="Release history" />
              <CardContent>
                <ul className="divide-y divide-hairline">
                  {launches.map((l) => (
                    <li key={l.id} className="py-3 text-small">
                      <div className="flex justify-between">
                        <span className="num text-ink-900">{formatDate(l.launchDate)}</span>
                        <span className="num text-ink-700">{l.soldPct.toFixed(0)}% sold</span>
                      </div>
                      <div className="text-ink-500">
                        {l.unitsReleased} units from {formatLocal(l.startingPrice, p.currency)} · {l.paymentPlan}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader eyebrow="Mandates" title="Advisory history" />
            <CardContent>
              {mandates.length === 0 && <p className="text-small text-ink-500">No mandates reference this property.</p>}
              <ul className="divide-y divide-hairline">
                {mandates.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                    <Link href={`/analyst/mandates/${m.id}`} className="min-w-0 text-small hover:underline">
                      <span className="num text-ink-500">{m.reference}</span> <span className="text-ink-900">{m.clientName}</span>
                    </Link>
                    <StagePill status={m.status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
