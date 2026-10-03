import { and, desc, eq, gte, sql } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { HANDLERS } from "@/lib/ai/orchestration/handlers";
import { OS_EVENT_TYPES } from "@/lib/ai/orchestration/event-bus";
import { agentCatalogue, agentUsage, COST_CEILING_USD } from "@/lib/ai/usage";
import { requirePlatformAdmin } from "@/lib/require-platform";

export const metadata = { title: "Agents" };
export const dynamic = "force-dynamic";

const usd = (v: number) => `$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`;

export default async function PlatformAgents() {
  await requirePlatformAdmin();
  const db = await getDb();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [usage, tenantsPerAgent, events, disabled] = await Promise.all([
    agentUsage(db),
    db.select({ actor: s.auditLogs.actorName, n: sql<number>`count(distinct ${s.auditLogs.tenantId})::int` }).from(s.auditLogs).where(and(eq(s.auditLogs.actorType, "agent"), gte(s.auditLogs.createdAt, since))).groupBy(s.auditLogs.actorName),
    db.select({ type: s.osEvents.type, n: sql<number>`count(*)::int`, agents: sql<number>`coalesce(sum(jsonb_array_length(${s.osEvents.agents})), 0)::int` }).from(s.osEvents).groupBy(s.osEvents.type).orderBy(desc(sql`count(*)`)),
    db.select({ cfg: s.tenants.configJson }).from(s.tenants),
  ]);
  const firms = new Map(tenantsPerAgent.map((r) => [r.actor.replace(/ agent$/, ""), r.n]));
  const offCount = new Map<string, number>();
  for (const t of disabled) for (const a of t.cfg.ai?.disabledAgents ?? []) offCount.set(a, (offCount.get(a) ?? 0) + 1);
  const triggers = new Map<string, string[]>();
  for (const type of OS_EVENT_TYPES) for (const h of HANDLERS[type] ?? []) triggers.set(h.agent, [...(triggers.get(h.agent) ?? []), type]);
  const rows = agentCatalogue().map((a) => {
    const u = usage.get(a.name);
    return { ...a, runs: u?.runs ?? 0, live: u?.liveRuns ?? 0, total: u?.totalUsd ?? 0, avg: u?.avgLiveUsd ?? null, avgMs: u?.avgMs ?? null, firms: firms.get(a.name) ?? 0, off: offCount.get(a.name) ?? 0, events: triggers.get(a.name) ?? [] };
  });
  const totalRuns = rows.reduce((x, r) => x + r.runs, 0);
  const totalUsd = rows.reduce((x, r) => x + r.total, 0);
  const costs = rows.map((r) => r.avg ?? r.estimateUsd).filter((c): c is number => c !== null);
  const meanCost = costs.reduce((a, b) => a + b, 0) / Math.max(1, costs.length);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Nakhla platform"
        title="Agents"
        subtitle="The full catalogue: thirteen mandate pipeline agents and thirty-two vertical agents across India, deals, commission, the client layer, business intelligence and the OS fabric. Usage and cost are read from every tenant's audit trail."
      />
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Agents" value={String(rows.length)} note={`${rows.filter((r) => r.runs > 0).length} have run`} />
        <StatCard label="Runs recorded" value={totalRuns.toLocaleString("en-US")} note={`$${totalUsd.toFixed(2)} live spend`} />
        <StatCard label="Mean cost per run" value={usd(meanCost)} note={`Ceiling $${COST_CEILING_USD.toFixed(2)}`} />
        <StatCard label="Above ceiling" value={String(costs.filter((c) => c > COST_CEILING_USD).length)} />
      </section>

      <Section title="Event bus" description="Nine cross-module events, each starting one to three agents. Every dispatch is recorded with the agents it ran and their outcome.">
        <SimpleTable
          rows={OS_EVENT_TYPES.map((t) => ({ t, handlers: (HANDLERS[t] ?? []).map((h) => h.agent), stat: events.find((e) => e.type === t) }))}
          minWidth={760}
          columns={[
            { key: "e", header: "Event", cell: (r) => <span className="num text-ink-900">{r.t}</span> },
            { key: "h", header: "Agents started", cell: (r) => r.handlers.join(", ") },
            { key: "n", header: "Events", numeric: true, cell: (r) => r.stat?.n ?? 0 },
            { key: "a", header: "Agent runs", numeric: true, cell: (r) => r.stat?.agents ?? 0 },
          ]}
        />
      </Section>

      <Section title="Catalogue" description="Average cost uses live runs; agents that have only run in replay show an estimate from prompt, tool schema and representative output at their model tier.">
        <SimpleTable
          rows={rows}
          minWidth={1240}
          columns={[
            { key: "no", header: "No.", numeric: true, cell: (r) => String(r.number).padStart(2, "0") },
            {
              key: "a",
              header: "Agent",
              cell: (r) => (
                <div>
                  <div className="text-ink-900">{r.label}</div>
                  <div className="max-w-[42ch] text-axis text-ink-500">{r.description}</div>
                </div>
              ),
            },
            { key: "m", header: "Module", cell: (r) => r.module },
            { key: "p", header: "Prompt", cell: (r) => <span className="num text-axis">{r.promptVersion}</span> },
            { key: "t", header: "Triggered by", cell: (r) => (r.events.length ? <span className="num text-axis">{r.events.join(", ")}</span> : <span className="text-ink-400">On demand</span>) },
            { key: "r", header: "Runs", numeric: true, cell: (r) => r.runs },
            { key: "f", header: "Firms, 30d", numeric: true, cell: (r) => r.firms },
            { key: "c", header: "Avg / run", numeric: true, cell: (r) => (r.avg !== null ? usd(r.avg) : r.estimateUsd !== null ? `${usd(r.estimateUsd)} est.` : "Replay only") },
            { key: "s", header: "Status", cell: (r) => (r.essential ? <Flag tone="complete">Essential</Flag> : r.off ? <Flag tone="neutral">{`Off at ${r.off}`}</Flag> : <Flag tone="complete">Active</Flag>) },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
