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
      <section className="my-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
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
            empty="No deals yet. Open one from a mandate or with Open deal."
            columns={[
              { key: "r", header: "Deal", cell: (r) => <Link href={`/analyst/deals/${r.deal.id}`} className="font-medium text-navy-900 underline decoration-ink-200 underline-offset-4"><span className="num">{r.deal.reference}</span></Link> },
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
          <div className="scrollbar-thin -mx-6 overflow-x-auto px-6 md:mx-0 md:px-0">
            <div className="grid min-w-[1180px] grid-cols-7 gap-3">
              {DEAL_STAGES.map((st) => {
                const col = rows.filter((r) => (st === "closed" ? r.deal.status === "won" : r.deal.status === "active" && r.deal.stage === st));
                return (
                  <div key={st} className="rounded-md bg-navy-50 p-2">
                    <div className="flex items-baseline justify-between px-1 py-2">
                      <span className="eyebrow">{STAGE_LABEL[st]}</span>
                      <span className="num text-axis text-ink-500">{col.length}</span>
                    </div>
                    <div className="space-y-2">
                      {col.map((r) => (
                        <Link key={r.deal.id} href={`/analyst/deals/${r.deal.id}`} className="block rounded-sm border border-hairline bg-surface p-3 shadow-card transition-[border-color] duration-150 hover:border-ink-400">
                          <div className="num text-axis text-ink-500">{r.deal.reference}</div>
                          <div className="mt-1 text-small font-medium text-ink-900">{r.property}</div>
                          <div className="text-small text-ink-700">{r.client}</div>
                          <div className="mt-2 flex items-baseline justify-between">
                            <span className="num text-small text-ink-900">{formatLocal(r.deal.value, r.deal.currency)}</span>
                            {r.deal.probability !== null && <span className={cn("num text-axis", r.deal.probability >= 0.6 ? "text-success" : "text-ink-500")}>{Math.round(r.deal.probability * 100)}%</span>}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
