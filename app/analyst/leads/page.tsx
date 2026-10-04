import { asc } from "drizzle-orm";
import Link from "next/link";
import { CreateLead } from "@/components/brokerage/actions";
import { marketOptions } from "@/components/brokerage/market-options";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { activeTab, SectionTabs } from "@/components/os/section-tabs";
import { SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { LEAD_STAGES } from "@/db/schema-brokerage";
import { requireRole } from "@/lib/auth";
import { firstResponseHours, listLeads, STAGE_LABEL } from "@/lib/brokerage/leads";
import { scoreBand } from "@/lib/brokerage/scoring";
import { formatLocal } from "@/lib/format";
import { LEAD_SOURCES, SOURCE_NAME } from "@/lib/markets";
import { scope } from "@/lib/tenant-db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Leads" };
export const dynamic = "force-dynamic";

const VIEWS = [
  ["board", "Board"],
  ["list", "List"],
  ["sources", "Sources"],
] as const;

const DAY = 86_400_000;

function Score({ score }: { score: number }) {
  const band = scoreBand(score);
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-1.5 rounded-full", band === "Hot" ? "bg-gold-500" : band === "Warm" ? "bg-navy-500" : "bg-ink-300")} aria-hidden />
      <span className="num tabular-nums">{score}</span>
    </span>
  );
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const view = activeTab(VIEWS, (await searchParams).view);
  const db = await getDb();
  const [rows, listings] = await Promise.all([listLeads(db, user.tenantId), db.select({ id: s.listings.id, name: s.listings.title, market: s.listings.market }).from(s.listings).where(scope(s.listings, user.tenantId)).orderBy(asc(s.listings.title))]);
  const open = rows.filter((r) => r.lead.stage !== "won" && r.lead.stage !== "lost");
  const now = Date.now();
  const fresh = rows.filter((r) => now - r.lead.createdAt.getTime() < 30 * DAY);
  const responseHours = await firstResponseHours(db, user.tenantId);
  const closed = rows.filter((r) => r.lead.stage === "won" || r.lead.stage === "lost");
  const won = rows.filter((r) => r.lead.stage === "won");
  const overdue = open.filter((r) => r.lead.nextActionAt && r.lead.nextActionAt.getTime() < now);
  const bySource = Object.entries(
    rows.reduce<Record<string, { n: number; won: number; score: number }>>((a, r) => {
      const k = r.lead.source;
      a[k] ??= { n: 0, won: 0, score: 0 };
      a[k].n += 1;
      a[k].score += r.lead.score;
      if (r.lead.stage === "won") a[k].won += 1;
      return a;
    }, {}),
  ).sort((a, b) => b[1].n - a[1].n);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Brokerage"
        title="Leads"
        subtitle="Every enquiry from the portals, the website, WhatsApp, walk-ins and referrals: assigned on arrival, scored on facts a broker can check, and worked to a viewing or a clear reason it was lost."
        actions={<CreateLead markets={marketOptions()} sources={LEAD_SOURCES.map((x) => ({ key: x.key, name: x.name }))} listings={listings} />}
      />
      <section className="my-8 stat-row">
        <StatCard label="Open leads" value={String(open.length)} note={`${fresh.length} arrived in the last 30 days`} />
        <StatCard label="Average first response" value={responseHours === null ? "None" : responseHours < 1 ? `${Math.round(responseHours * 60)} min` : `${responseHours.toFixed(1)} h`} note="Arrival to first contact" />
        <StatCard label="Conversion" value={closed.length ? `${Math.round((won.length / closed.length) * 100)}%` : "None"} note={`${won.length} won of ${closed.length} closed`} />
        <StatCard label="Overdue follow-ups" value={String(overdue.length)} note={overdue[0] ? `Oldest: ${overdue[0].lead.reference}` : "None outstanding"} />
      </section>
      <SectionTabs base="/analyst/leads" tabs={VIEWS} active={view} label="Lead views" param="view" />
      <div className="mt-8">
        {view === "board" && (
          <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-4 md:-mx-12 md:px-12 xl:-mx-20 xl:px-20">
            <div className="flex min-w-max gap-3">
              {LEAD_STAGES.map((st) => {
                const col = rows.filter((r) => r.lead.stage === st);
                return (
                  <section key={st} aria-label={STAGE_LABEL[st]} className="w-[260px] shrink-0">
                    <header className="flex h-8 items-center gap-2">
                      <h3 className="label-caps">{STAGE_LABEL[st]}</h3>
                      <span className="num text-axis text-ink-500">{col.length}</span>
                    </header>
                    <div className="flex flex-col gap-2 pt-2">
                      {col.map((r) => (
                        <Link key={r.lead.id} href={`/analyst/leads/${r.lead.id}`} className="flex flex-col justify-center rounded-md border border-hairline bg-surface px-3 py-2.5 transition-[border-color] duration-150 hover:border-ink-200">
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-ui font-medium text-ink-900">{r.lead.name}</span>
                            <Score score={r.lead.score} />
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 text-meta text-ink-500">
                            <span className="min-w-0 flex-1 truncate">{r.listing ?? r.lead.locations[0] ?? r.lead.intent}</span>
                            <span className="shrink-0">{SOURCE_NAME[r.lead.source] ?? r.lead.source}</span>
                          </div>
                        </Link>
                      ))}
                      {col.length === 0 && <p className="pt-2 text-meta text-ink-400">No leads at this stage</p>}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
        {view === "list" && (
          <SimpleTable
            rows={rows}
            minWidth={1040}
            empty="No leads yet. Connect a portal on the Integrations page, or record one with Record lead."
            columns={[
              { key: "r", header: "Lead", cell: (r) => <Link href={`/analyst/leads/${r.lead.id}`} className="text-ink-900 hover:underline"><span className="num">{r.lead.reference}</span> · {r.lead.name}</Link> },
              { key: "s", header: "Score", numeric: true, cell: (r) => <Score score={r.lead.score} /> },
              { key: "st", header: "Stage", cell: (r) => (r.lead.stage === "won" ? <Flag tone="complete">Won</Flag> : r.lead.stage === "lost" ? <Flag tone="neutral">Lost</Flag> : STAGE_LABEL[r.lead.stage]) },
              { key: "src", header: "Source", cell: (r) => SOURCE_NAME[r.lead.source] ?? r.lead.source },
              { key: "i", header: "Interest", cell: (r) => r.listing ?? r.lead.locations.join(", ") },
              { key: "b", header: "Budget", numeric: true, cell: (r) => (r.lead.budgetMax ? formatLocal(r.lead.budgetMax, r.lead.currency) : "None") },
              { key: "o", header: "Owner", cell: (r) => r.owner ?? "Unassigned" },
              { key: "n", header: "Next action", cell: (r) => (r.lead.nextActionAt ? <span className={cn(r.lead.nextActionAt.getTime() < now && "text-danger")}>{r.lead.nextAction} · <RelativeTime iso={r.lead.nextActionAt.toISOString()} /></span> : "None") },
            ]}
          />
        )}
        {view === "sources" && (
          <SimpleTable
            rows={bySource}
            minWidth={640}
            columns={[
              { key: "s", header: "Source", cell: ([k]) => SOURCE_NAME[k] ?? k },
              { key: "n", header: "Leads", numeric: true, cell: ([, v]) => v.n },
              { key: "w", header: "Won", numeric: true, cell: ([, v]) => v.won },
              { key: "a", header: "Average score", numeric: true, cell: ([, v]) => Math.round(v.score / v.n) },
              { key: "c", header: "Share", numeric: true, cell: ([, v]) => `${Math.round((v.n / rows.length) * 100)}%` },
            ]}
          />
        )}
        {view === "sources" && (
          <section className="mt-10 max-w-[80ch] text-ui text-ink-700" aria-label="Lead capture">
            <h2 className="font-display text-section text-navy-900">Lead capture</h2>
            <p className="mt-2">
              Each portal, website form or email forwarder posts enquiries to <code className="num text-ink-900">/api/leads/inbound/&#123;source&#125;</code> with the firm&apos;s API key as a bearer token. Field names are mapped automatically; the listing is matched by reference, the lead is assigned in rotation and scored on arrival. Sources: {LEAD_SOURCES.map((x) => x.key).join(", ")}. Issue keys under Administration, Integrations.
            </p>
          </section>
        )}
      </div>
    </PageContainer>
  );
}
