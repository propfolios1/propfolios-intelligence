import { eq } from "drizzle-orm";
import { MetricBand } from "@/components/bi/metric-band";
import { BiJob } from "@/components/bi/bi-actions";
import { PageHeader } from "@/components/composites/page-header";
import { Flag } from "@/components/os/badges";
import { activeTab, SectionTabs } from "@/components/os/section-tabs";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { lastOutput } from "@/lib/ai/agents/define";
import { clerkEnabled, requireRole } from "@/lib/auth";
import { MARKETS } from "@/lib/bi/agents";
import { CATEGORIES, type Category, MIN_FIRMS, MIN_OBSERVATIONS } from "@/lib/bi/metrics";
import { firmMetricsFor, listMarketReports, visibleBenchmarks } from "@/lib/bi/service";
import { AgentOutput } from "@/components/os/agent-output";
import { StructuredDetail } from "@/components/os/structured-detail";

export const metadata = { title: "Benchmarks" };
export const dynamic = "force-dynamic";

const TABS = [
  ["firm", "Your firm"],
  ["benchmarks", "Benchmarks"],
  ["reports", "Market reports"],
] as const;

export default async function Benchmarks({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const tab = activeTab(TABS, (await searchParams).tab);
  const db = await getDb();
  const [t] = await db.select({ consent: s.tenants.consentFederation }).from(s.tenants).where(eq(s.tenants.id, user.tenantId));
  const indicative = !clerkEnabled;
  const [metrics, bench, reports, analyst] = await Promise.all([firmMetricsFor(db, user.tenantId), t?.consent ? visibleBenchmarks(db, { includeIndicative: indicative }) : Promise.resolve([]), listMarketReports(db, user.tenantId), lastOutput(user.tenantId, "firm-analyst", user.tenantId)]);
  return (
    <PageContainer>
      <PageHeader eyebrow="Intelligence" title="Benchmarks" subtitle={`Your firm's operating metrics against anonymised figures from other advisory firms. A benchmark is published only when at least ${MIN_FIRMS} firms and ${MIN_OBSERVATIONS} deals contribute; no firm can be identified.`} />
      <div className="mt-6">
        <SectionTabs base="/analyst/benchmarks" tabs={TABS} active={tab} label="Benchmark sections" />
      </div>
      {!t?.consent && tab !== "reports" && <p className="mt-8 max-w-[65ch] text-body text-ink-700">Benchmarks are available to firms that contribute. Opt in to federated learning in Administration → Intelligence to see them.</p>}
      {tab === "firm" && t?.consent && (
        <>
          <Section title="Your firm against the cohort" description={metrics[0] ? `${metrics[0].cohort.firms} contributing firms this quarter${metrics[0].cohort.firms < MIN_FIRMS ? "; positions are indicative until the cohort reaches five firms" : ""}. The band is the middle half of firms; the line is the median.` : "Computed nightly."}>
            <SimpleTable
              rows={metrics}
              minWidth={860}
              empty="No metrics yet; the nightly run computes them."
              columns={[
                { key: "m", header: "Metric", cell: (r) => <span className="text-ink-900">{CATEGORIES[r.metricName as Category]?.label ?? r.metricName}</span> },
                { key: "v", header: "Your firm", numeric: true, cell: (r) => `${r.value} ${r.unit}` },
                { key: "c", header: "Median", numeric: true, cell: (r) => (r.cohort.median !== null ? `${r.cohort.median} ${r.unit}` : "None") },
                { key: "b", header: "Position", className: "w-[34%]", cell: (r) => <MetricBand value={r.value} median={r.cohort.median} p25={r.cohort.p25} p75={r.cohort.p75} unit={r.unit} betterIsHigher={r.cohort.betterIsHigher} /> },
                { key: "r", header: "Rank", numeric: true, cell: (r) => (r.rankPct !== null ? `${r.rankPct}` : "None") },
              ]}
            />
          </Section>
          <Section title="Assessment" eyebrow="Agent 37 · Firm analyst">
            {analyst && (
              <AgentOutput className="mb-4" agent="Firm analyst" output={analyst.output} model={analyst.model} costUsd={analyst.costUsd} at={analyst.at}>
                <StructuredDetail output={analyst.output as unknown as Record<string, unknown>} />
              </AgentOutput>
            )}
            <BiJob job="firm-analyst" label={analyst ? "Run again" : "Assess the firm"} agent="Firm analyst" />
          </Section>
        </>
      )}
      {tab === "benchmarks" && t?.consent && (
        <Section title="Benchmarks" description={indicative ? "Demonstration mode: benchmarks below the thresholds are shown as indicative. In production only published benchmarks appear." : "Published benchmarks only."}>
          <SimpleTable
            rows={bench.filter((b) => b.segment === "All")}
            minWidth={900}
            empty="No benchmark has reached the publication thresholds yet."
            columns={[
              { key: "m", header: "Metric", cell: (b) => <span className="text-ink-900">{b.metric}</span> },
              { key: "r", header: "Market", cell: (b) => (b.region === "All" ? "All markets" : b.region.replace("_", " ")) },
              { key: "v", header: "Median", numeric: true, cell: (b) => `${b.value} ${b.unit}` },
              { key: "q", header: "Middle half", numeric: true, cell: (b) => (b.p25 !== null ? `${b.p25} to ${b.p75}` : "None") },
              { key: "n", header: "Cohort", numeric: true, cell: (b) => `${b.firms} firms, ${b.sampleSize} obs.` },
              { key: "p", header: "Status", cell: (b) => <Flag tone={b.published ? "complete" : "progress"}>{b.published ? "Published" : "Indicative"}</Flag> },
            ]}
          />
        </Section>
      )}
      {tab === "reports" && (
        <>
          <Section title="Write a report" description="Monthly pulses are shared with clients; quarterly outlooks stay internal until you share them.">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <div className="eyebrow mb-2">Agent 38 · Market report writer</div>
                <BiJob job="market-report" label="Write monthly pulse" agent="Market report writer" regions={MARKETS.map((m) => m.region)} />
              </div>
              <div>
                <div className="eyebrow mb-2">Agent 40 · Quarterly outlook</div>
                <BiJob job="outlook" label="Write quarterly outlook" agent="Quarterly outlook" regions={MARKETS.map((m) => m.region)} />
              </div>
            </div>
          </Section>
          <Section title="Reports">
            <SimpleTable
              rows={reports}
              minWidth={760}
              columns={[
                { key: "t", header: "Title", cell: (r) => <span className="text-ink-900">{r.title}</span> },
                { key: "k", header: "Type", cell: (r) => (r.type === "monthly_pulse" ? "Monthly pulse" : r.type === "quarterly_outlook" ? "Quarterly outlook" : "Segment report") },
                { key: "s", header: "Clients", cell: (r) => <Flag tone={r.sharedWithClients ? "complete" : "neutral"}>{r.sharedWithClients ? "Shared" : "Internal"}</Flag> },
                { key: "g", header: "Written", cell: (r) => <RelativeTime iso={r.generatedAt.toISOString()} /> },
              ]}
            />
          </Section>
        </>
      )}
    </PageContainer>
  );
}
