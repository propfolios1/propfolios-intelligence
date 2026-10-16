import { and, desc, eq } from "drizzle-orm";
import { ArrowRight, Building2, Coins, Hammer, LineChart, MessageSquare, Percent, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/composites/empty-state";
import { Photo } from "@/components/media/photo";
import { NextSteps } from "@/components/portal/next-steps";
import { PropertyCard } from "@/components/portal/property-card";
import { Term } from "@/components/portal/term";
import { Donut, KpiTile, Ring, TONE_ORDER } from "@/components/portal/tiles";
import { LiveRefresh } from "@/components/realtime/realtime-indicator";
import { Avatar } from "@/components/ui/avatar";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { clientContracts } from "@/lib/contracts/service";
import { GLOSSARY } from "@/lib/client/glossary";
import { nextSteps, readiness } from "@/lib/client/next-steps";
import { formatLocal } from "@/lib/format";
import { sceneFor } from "@/lib/media/subjects";
import { photosForProperties, type PhotoBundle } from "@/lib/media/unsplash";
import { getPortfolio, listMessages, listProperties } from "@/lib/queries";
import { scope } from "@/lib/tenant-db";
import { cn, formatMoney, relativeTime } from "@/lib/utils";

export const metadata = { title: "Home" };
export const dynamic = "force-dynamic";

const STATUS_RIBBON: Record<string, { label: string; tone: "mint" | "sun" | "sky" }> = {
  performing: { label: "Performing", tone: "mint" },
  watch: { label: "On watch", tone: "sun" },
  under_construction: { label: "Under construction", tone: "sky" },
};

function listCities(cities: string[]) {
  if (cities.length <= 1) return cities[0] ?? "";
  return `${cities.slice(0, -1).join(", ")} and ${cities.at(-1)}`;
}

export default async function ClientHome() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  if (!user.clientId) {
    return (
      <PageContainer>
        <EmptyState glyph="documents" headline="No client record is linked to this account" note="Your relationship manager links your login to your client record. Once linked, your holdings, reports and statements appear here." primary={{ label: "Message your adviser", href: "/client/messages" }} secondary={{ label: "Account settings", href: "/client/settings" }} />
      </PageContainer>
    );
  }
  const db = await getDb();
  const clientId = user.clientId;
  const [p, kycRows, contracts, invoices, reports, goals, messages, catalogue] = await Promise.all([
    getPortfolio(db, user, clientId),
    db.select({ status: s.kycVerifications.status, expiresAt: s.kycVerifications.expiresAt }).from(s.kycVerifications).where(scope(s.kycVerifications, user.tenantId, eq(s.kycVerifications.clientId, clientId))).orderBy(desc(s.kycVerifications.createdAt)).limit(1),
    clientContracts(db, user.tenantId, clientId),
    db.select().from(s.invoices).where(scope(s.invoices, user.tenantId, eq(s.invoices.clientId, clientId))),
    db.select({ id: s.clientReports.id, title: s.clientReports.title, type: s.clientReports.type, viewedAt: s.clientReports.viewedAt, generatedAt: s.clientReports.generatedAt }).from(s.clientReports).where(and(eq(s.clientReports.tenantId, user.tenantId), eq(s.clientReports.clientId, clientId))),
    db.select().from(s.clientGoals).where(and(eq(s.clientGoals.tenantId, user.tenantId), eq(s.clientGoals.clientId, clientId))),
    listMessages(db, user, clientId),
    listProperties(db, user.tenantId),
  ]);
  const rm = p.client.relationshipManagerId ? (await db.select({ name: s.users.name, title: s.users.title }).from(s.users).where(and(eq(s.users.tenantId, user.tenantId), eq(s.users.id, p.client.relationshipManagerId))))[0] : undefined;

  const stepInput = {
    kyc: kycRows[0] ? { status: kycRows[0].status, expiresAt: kycRows[0].expiresAt } : null,
    contracts: contracts.map((c) => ({ id: c.c.id, title: c.c.title, status: c.c.status, deal: c.deal })),
    invoices: invoices.map((i) => ({ id: i.id, number: i.number, status: i.status, total: i.total, currency: i.currency, dueAt: i.dueAt })),
    reports,
    recommendations: p.recommendations.map((r) => ({ id: r.id, title: r.title, priority: r.priority })),
    goals: goals.map((g) => ({ id: g.id, title: g.title, progressPct: g.progressPct, by: g.target.by })),
  };
  const steps = nextSteps(stepInput);
  const ready = readiness(stepInput);

  const held = new Set(p.holdings.map((h) => h.propertyId));
  const markets = new Set<string>(p.client.policy.markets?.length ? p.client.policy.markets : p.holdings.map((h) => h.property.market));
  const picks = catalogue
    .filter((x) => !held.has(x.id) && markets.has(x.market))
    .sort((a, b) => b.grossYield - b.developerRisk / 40 - (a.grossYield - a.developerRisk / 40))
    .slice(0, 3);

  const lead = p.holdings[0];
  const media = await photosForProperties([...p.holdings.map((h) => ({ seed: h.property.slug, city: h.property.city, community: h.property.community, kind: h.property.assetClass })), ...picks.map((x) => ({ seed: x.slug, city: x.city, community: x.community, kind: x.assetClass }))]);
  const bundle = (slug: string, city: string): PhotoBundle => media.get(slug) ?? { photo: null, scene: sceneFor(city) };

  const cities = [...new Set(p.holdings.map((h) => h.property.city))];
  let running = 0;
  const cumulativeRent = p.cashHistory.map((m) => (running += m.rent));
  const rentLast12 = p.cashHistory.slice(-12).reduce((a, m) => a + m.rent, 0);
  const lastMessage = [...messages].reverse().find((m) => m.authorRole !== "client");
  const today = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Dubai" }).format(new Date());
  const first = p.client.name.split(/\s+/)[0];
  const gainTone = p.totals.gainPct >= 0 ? "mint" : "coral";
  const allocation = (cities.length > 1 ? p.byCity : p.byCommunity).sort((a, b) => b.value - a.value);

  return (
    <PageContainer className="pt-6 md:pt-8">
      {/* Hero: the client's largest holding, photographed, with the one number that matters. */}
      <section className="relative overflow-hidden rounded-lg" aria-labelledby="home-title">
        <Photo seed={lead ? lead.property.slug : p.client.id} scene={lead ? bundle(lead.property.slug, lead.property.city).scene : "dubai"} photo={lead ? bundle(lead.property.slug, lead.property.city).photo : null} ownSrc={null} alt={lead ? `${lead.property.name}, ${lead.property.community}` : "Skyline"} className="h-[380px] md:h-[400px]" sceneWidth={1000} sizes="100vw" priority>
          <span aria-hidden className="absolute inset-0 bg-linear-to-r from-black/70 via-black/40 to-black/5" />
        </Photo>
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-end gap-6 p-6 md:flex-row md:items-end md:justify-between md:p-10">
          <div className="pointer-events-auto max-w-[620px] text-white">
            <p className="text-meta font-medium tracking-wide text-white/80">
              {today} · {first}&apos;s portfolio
            </p>
            <h1 id="home-title" className="mt-3 font-display text-page-sm text-white md:text-title">
              Worth {formatMoney(p.totals.value)}, {p.totals.gainPct >= 0 ? "up" : "down"} {Math.abs(p.totals.gainPct).toFixed(1)}% on what you paid
            </h1>
            <p className="mt-3 text-ui text-white/85 md:text-body">
              {p.holdings.length} {p.holdings.length === 1 ? "home" : "homes"} in {listCities(cities)}, earning {formatMoney(p.totals.rent)} a year in rent.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/client/portfolio" className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-5 text-ui font-medium text-ink-900 transition-transform duration-150 hover:-translate-y-px">
                View portfolio
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/client/messages" className="inline-flex h-10 items-center gap-2 rounded-full border border-white/40 bg-white/10 px-5 text-ui font-medium text-white backdrop-blur-md transition-[background-color] duration-150 hover:bg-white/20">
                <MessageSquare className="size-4" aria-hidden />
                Message your adviser
              </Link>
            </div>
          </div>
          <Link href="#attention" className="pointer-events-auto hidden items-center gap-4 rounded-lg border border-white/25 bg-white/12 p-4 text-white backdrop-blur-md transition-[background-color] duration-150 hover:bg-white/20 md:flex">
            <Ring pct={ready.pct} tone={ready.pct === 100 ? "mint" : "sun"} size={56} stroke={6}>
              <span className="num text-meta font-semibold text-white">{ready.done}/{ready.total}</span>
            </Ring>
            <span>
              <span className="block text-ui font-semibold">{steps.length ? `${steps.length} ${steps.length === 1 ? "thing needs" : "things need"} you` : "All in order"}</span>
              <span className="block text-meta text-white/75">Verification, contracts, invoices, reports</span>
            </span>
          </Link>
        </div>
      </section>

      {/* Figures, one hue each, every term explained on tap. */}
      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Portfolio figures">
        <KpiTile tone="sea" icon={Wallet} label={<Term k="value">Value</Term>} value={formatMoney(p.totals.value)} sub={`Cost ${formatMoney(p.totals.cost)}`} />
        <KpiTile tone={gainTone} icon={TrendingUp} label={<Term k="gain">Gain on cost</Term>} value={`${p.totals.gainPct >= 0 ? "+" : ""}${p.totals.gainPct.toFixed(1)}%`} sub={formatMoney(p.totals.value - p.totals.cost)} />
        <KpiTile tone="iris" icon={LineChart} label={<Term k="irr" />} value={`${p.totals.irr.toFixed(1)}%`} sub="A year, since purchase" />
        <KpiTile tone="sun" icon={Coins} label={<Term k="rent">Annual rent</Term>} value={formatMoney(p.totals.rent)} sub={`${formatMoney(rentLast12)} received in 12 months`} trend={cumulativeRent} />
        <KpiTile tone="sky" icon={Percent} label={<Term k="cashYield" />} value={`${p.totals.cashYield.toFixed(1)}%`} sub={`Target ${p.client.policy.targetNetYield}% net`} />
        <KpiTile tone="coral" icon={Hammer} label={<Term k="offPlan" />} value={`${p.totals.offPlanPct.toFixed(0)}%`} sub={p.totals.offPlanPct > p.client.policy.maxOffPlanPct ? `Above your ${p.client.policy.maxOffPlanPct}% limit` : `Limit ${p.client.policy.maxOffPlanPct}%`} />
      </section>

      <div className="mt-10 grid grid-cols-1 gap-10 xl:grid-cols-12">
        <div className="min-w-0 space-y-10 xl:col-span-8">
          <section id="attention" aria-labelledby="attention-title" className="scroll-mt-20">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="attention-title" className="text-section font-semibold tracking-tight text-ink-900">
                What needs your attention
              </h2>
              <span className="flex items-center gap-3">
                <LiveRefresh name="home" tables={[{ table: "portfolios", filter: `client_id=eq.${clientId}` }, { table: "recommendations" }]} />
                <span className="num text-meta text-ink-500">{steps.length} open</span>
              </span>
            </div>
            <NextSteps steps={steps} />
          </section>

          <section aria-labelledby="homes-title">
            <div className="mb-4 flex items-baseline justify-between gap-4">
              <h2 id="homes-title" className="text-section font-semibold tracking-tight text-ink-900">
                Your properties
              </h2>
              <Link href="/client/portfolio" className="text-meta font-medium text-sea-700 hover:text-sea-600">
                All {p.holdings.length} holdings
              </Link>
            </div>
            {p.holdings.length === 0 ? (
              <EmptyState glyph="opportunities" headline="No holdings yet" note="Properties you buy through your adviser appear here with their value, rent and progress to handover." primary={{ label: "Browse opportunities", href: "/client/opportunities" }} secondary={{ label: "Message your adviser", href: "/client/messages" }} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {p.holdings.slice(0, 6).map((h, i) => {
                  const change = h.costAed ? ((h.currentValueAed - h.costAed) / h.costAed) * 100 : 0;
                  return (
                    <PropertyCard
                      key={h.id}
                      seed={h.property.slug}
                      media={bundle(h.property.slug, h.property.city)}
                      ownSrc={h.property.imageUrl}
                      href="/client/portfolio"
                      title={h.property.name}
                      place={`${h.unitLabel} · ${h.property.community}, ${h.property.city}`}
                      ribbon={STATUS_RIBBON[h.status] ?? { label: h.status.replace(/_/g, " "), tone: "sky" }}
                      priority={i < 2}
                      stats={[
                        { label: "Value", value: formatMoney(h.currentValueAed) },
                        { label: "Since purchase", value: `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`, tone: change >= 0 ? "mint" : "coral" },
                        { label: "Rent a year", value: h.annualRentAed ? formatMoney(h.annualRentAed) : "Not let", tone: h.annualRentAed ? "sun" : undefined },
                      ]}
                    />
                  );
                })}
              </div>
            )}
          </section>

          {picks.length > 0 && (
            <section aria-labelledby="picks-title">
              <div className="mb-4 flex items-baseline justify-between gap-4">
                <div>
                  <h2 id="picks-title" className="text-section font-semibold tracking-tight text-ink-900">
                    Picked for you
                  </h2>
                  <p className="mt-1 text-meta text-ink-500">In the markets your investment policy covers, ranked by yield and developer track record.</p>
                </div>
                <Link href="/client/opportunities" className="shrink-0 text-meta font-medium text-coral-700 hover:text-coral-600">
                  All opportunities
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {picks.map((x) => (
                  <PropertyCard
                    key={x.id}
                    seed={x.slug}
                    media={bundle(x.slug, x.city)}
                    ownSrc={x.imageUrl}
                    href={`/client/opportunities#${x.slug}`}
                    title={x.name}
                    place={`${x.community}, ${x.city}`}
                    ribbon={x.status === "ready" ? { label: "Ready to move in", tone: "mint" } : { label: `Handover ${x.handover}`, tone: "iris" }}
                    stats={[
                      { label: "From", value: formatLocal(x.priceMin, x.currency) },
                      { label: "Gross yield", value: `${x.grossYield.toFixed(1)}%`, tone: "sun" },
                    ]}
                    footer={<span>By {x.developerName}</span>}
                  />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-6 xl:col-span-4">
          <section className="rounded-lg border border-hairline bg-surface p-5" aria-labelledby="adviser-title">
            <h2 id="adviser-title" className="text-ui font-semibold text-ink-900">
              Your adviser
            </h2>
            <div className="mt-4 flex items-center gap-3">
              <Avatar name={rm?.name ?? lastMessage?.authorName ?? "Advisory team"} size={40} />
              <div className="min-w-0">
                <div className="truncate text-ui font-medium text-ink-900">{rm?.name ?? lastMessage?.authorName ?? "Your advisory team"}</div>
                <div className="truncate text-meta text-ink-500">{rm?.title ?? "Relationship manager"}</div>
              </div>
            </div>
            {lastMessage && (
              <blockquote className="mt-4 rounded-md bg-sky-50 p-3 text-meta text-ink-700">
                <p className="line-clamp-3">{lastMessage.body}</p>
                <footer className="mt-2 text-axis text-sky-700">{relativeTime(lastMessage.createdAt.toISOString())}</footer>
              </blockquote>
            )}
            <Link href="/client/messages" className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-full bg-sky-600 text-ui font-medium text-white transition-[background-color] duration-150 hover:bg-sky-700">
              <MessageSquare className="size-4" aria-hidden />
              Send a message
            </Link>
          </section>

          <section className="rounded-lg border border-hairline bg-surface p-5" aria-labelledby="mix-title">
            <h2 id="mix-title" className="text-ui font-semibold text-ink-900">
              Where your money is
            </h2>
            <div className="mt-4">
              <Donut
                items={allocation.map((a) => ({ label: a.city, value: a.value }))}
                centre={
                  <span>
                    <span className="num block text-ui font-semibold text-ink-900">{formatMoney(p.totals.value)}</span>
                    <span className="block text-axis text-ink-500">{allocation.length} {cities.length > 1 ? "cities" : "communities"}</span>
                  </span>
                }
              />
            </div>
          </section>

          <section className="rounded-lg border border-hairline bg-surface p-5" aria-labelledby="goals-title">
            <div className="flex items-baseline justify-between">
              <h2 id="goals-title" className="text-ui font-semibold text-ink-900">
                Goals
              </h2>
              <Link href="/client/goals" className="text-meta font-medium text-sun-700 hover:text-sun-600">
                Details
              </Link>
            </div>
            {goals.length === 0 ? (
              <p className="mt-3 text-meta text-ink-500">Your adviser agrees income, growth and allocation goals with you at your next review.</p>
            ) : (
              <ul className="mt-4 space-y-4">
                {goals.slice(0, 4).map((g, i) => (
                  <li key={g.id} className="flex items-center gap-4">
                    <Ring pct={g.progressPct} tone={TONE_ORDER[(i + 2) % TONE_ORDER.length]!} size={52} stroke={6} />
                    <div className="min-w-0">
                      <div className="truncate text-meta font-medium text-ink-900">{g.title}</div>
                      <div className="num text-axis text-ink-500">
                        {g.target.current.toLocaleString("en-US")} of {g.target.target.toLocaleString("en-US")} {g.target.unit} by {g.target.by}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg border border-iris-100 bg-linear-to-br from-iris-50 to-surface p-5" aria-labelledby="terms-title">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-iris-100 text-iris-700">
                <Building2 className="size-4 stroke-[1.75]" aria-hidden />
              </span>
              <h2 id="terms-title" className="text-ui font-semibold text-ink-900">
                Understanding your numbers
              </h2>
            </div>
            <p className="mt-2 text-meta text-ink-500">Tap any underlined term across the portal for a plain explanation.</p>
            <dl className="mt-4 space-y-3">
              {(["irr", "cashYield", "handover", "escrow"] as const).map((k) => (
                <div key={k}>
                  <dt className="text-meta font-medium text-ink-900">{GLOSSARY[k].term}</dt>
                  <dd className={cn("mt-0.5 text-meta text-ink-700")}>{GLOSSARY[k].plain}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
