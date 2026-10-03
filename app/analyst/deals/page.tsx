import { asc } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { CreateDeal } from "@/components/deals/create-deal";
import { Flag } from "@/components/os/badges";
import { activeTab, SectionTabs } from "@/components/os/section-tabs";
import { SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DEAL_STAGES, JURISDICTION_LABEL, STAGE_LABEL } from "@/lib/deals/domain";
import { listDeals } from "@/lib/deals/service";
import { formatLocal } from "@/lib/format";
import { scope } from "@/lib/tenant-db";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Deals" };
export const dynamic = "force-dynamic";

const VIEWS = [
  ["list", "List"],
  ["board", "Board"],
] as const;
const AED = { AED: 1, INR: 1 / 22.6, USD: 3.6725 } as Record<string, number>;

export default async function DealsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const view = activeTab(VIEWS, (await searchParams).view);
  const db = await getDb();
  const [rows, clients, props] = await Promise.all([
    listDeals(db, user.tenantId),
    db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(scope(s.clients, user.tenantId)).orderBy(asc(s.clients.name)),
    db.select({ id: s.properties.id, name: s.properties.name, city: s.properties.city, currency: s.properties.currency, priceMin: s.properties.priceMin }).from(s.properties).where(scope(s.properties, user.tenantId)).orderBy(asc(s.properties.name)),
  ]);
  const active = rows.filter((r) => r.deal.status === "active");
  const pipeline = active.reduce((a, r) => a + r.deal.value * (AED[r.deal.currency] ?? 1), 0);
  const weighted = active.reduce((a, r) => a + r.deal.value * (AED[r.deal.currency] ?? 1) * (r.deal.probability ?? 0.3), 0);
  const won = rows.filter((r) => r.deal.status === "won");
  return (
    <PageContainer>
      <PageHeader eyebrow="Execution" title="Deals" subtitle="From first offer to completion: offers and counters, negotiation rounds, contracts and signatures, the jurisdiction's closing checklist and the payment schedule. Closing a deal starts the commission chain." actions={<CreateDeal clients={clients} properties={props.filter((p) => !!p)} />} />
      <section className="my-8 stat-row">
        <StatCard label="Active deals" value={String(active.length)} note={`${rows.length} in total`} />
        <StatCard label="Pipeline" value={formatLocal(pipeline, "AED")} note="Active, at deal value" />
        <StatCard label="Probability-weighted" value={formatLocal(weighted, "AED")} note="Deal predictor forecasts" />
        <StatCard label="Closed" value={String(won.length)} note={won[0] ? `Last: ${won[0].deal.reference}` : "None yet"} />
      </section>
      <SectionTabs base="/analyst/deals" tabs={VIEWS} active={view} label="Deal views" param="view" />
      <div className="mt-8">
        {view === "list" ? (
          <SimpleTable
            rows={rows}
            minWidth={1000}
            empty="No deals yet. Open one with Open deal, or from a delivered mandate."
            columns={[
              { key: "r", header: "Deal", cell: (r) => <Link href={`/analyst/deals/${r.deal.id}`} className="text-ink-900 hover:underline"><span className="num">{r.deal.reference}</span></Link> },
              { key: "t", header: "Property", cell: (r) => `${r.property}, ${r.city}` },
              { key: "c", header: "Client", cell: (r) => r.client },
              { key: "j", header: "Jurisdiction", cell: (r) => JURISDICTION_LABEL[r.deal.jurisdiction] },
              { key: "s", header: "Stage", cell: (r) => (r.deal.status === "active" ? STAGE_LABEL[r.deal.stage] : <Flag tone={r.deal.status === "won" ? "complete" : "neutral"}>{r.deal.status}</Flag>) },
              { key: "v", header: "Value", numeric: true, cell: (r) => formatLocal(r.deal.value, r.deal.currency) },
              { key: "p", header: "Probability", numeric: true, cell: (r) => (r.deal.probability !== null ? `${Math.round(r.deal.probability * 100)}%` : "None") },
              { key: "d", header: "Target close", cell: (r) => (r.deal.targetCloseDate ? formatDate(r.deal.targetCloseDate) : "None") },
            ]}
          />
        ) : (
          <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-4 md:-mx-12 md:px-12 xl:-mx-20 xl:px-20">
            <div className="flex min-w-max gap-3">
              {DEAL_STAGES.map((st) => {
                const col = rows.filter((r) => (st === "closed" ? r.deal.status === "won" : r.deal.status === "active" && r.deal.stage === st));
                return (
                  <section key={st} aria-label={STAGE_LABEL[st]} className="w-[280px] shrink-0">
                    <header className="flex h-8 items-center gap-2">
                      <h3 className="label-caps">{STAGE_LABEL[st]}</h3>
                      <span className="num text-axis text-ink-500">{col.length}</span>
                    </header>
                    <div className="flex flex-col gap-2 pt-2">
                      {col.map((r) => (
                        <Link key={r.deal.id} href={`/analyst/deals/${r.deal.id}`} className="flex h-[60px] flex-col justify-center rounded-md border border-hairline bg-surface px-3 transition-[border-color] duration-150 hover:border-ink-200">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-ui font-medium text-ink-900">{r.client}</span>
                            <span className={cn("size-1.5 shrink-0 rounded-full", st === "closed" ? "bg-success" : "bg-gold-500")} aria-hidden />
                            <span className="num shrink-0 text-axis text-ink-400" title="Probability of closing">
                              {r.deal.probability !== null ? `${Math.round(r.deal.probability * 100)}%` : ""}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-meta text-ink-500">{r.property}</span>
                            <span className="num shrink-0 text-axis text-ink-400">{r.deal.reference}</span>
                          </div>
                        </Link>
                      ))}
                      {col.length === 0 && <p className="pt-2 text-meta text-ink-400">No deals at this stage</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
