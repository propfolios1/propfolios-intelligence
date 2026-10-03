import { desc, sql } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { MIN_FIRMS, MIN_OBSERVATIONS } from "@/lib/bi/metrics";
import { federationStats, MIN_ADVISORIES, MIN_DEALS } from "@/lib/federation";
import { requirePlatformAdmin } from "@/lib/require-platform";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Federation dashboard" };
export const dynamic = "force-dynamic";

export default async function FederationDashboard() {
  await requirePlatformAdmin();
  const db = await getDb();
  const [stats, tenants, learnings, bench, runs] = await Promise.all([
    federationStats(db),
    db.select({ id: s.tenants.id, consent: s.tenants.consentFederation, status: s.tenants.status, cfg: s.tenants.configJson }).from(s.tenants),
    db.select({ q: s.federationLearnings.deliveredQuarter, n: sql<number>`count(*)::int` }).from(s.federationLearnings).groupBy(s.federationLearnings.deliveredQuarter).orderBy(s.federationLearnings.deliveredQuarter),
    db.select({ cat: s.benchmarks.category, total: sql<number>`count(*)::int`, published: sql<number>`count(*) filter (where ${s.benchmarks.published})::int`, maxFirms: sql<number>`max(${s.benchmarks.firms})::int` }).from(s.benchmarks).groupBy(s.benchmarks.category),
    db.select().from(s.federationRuns).orderBy(desc(s.federationRuns.createdAt)).limit(1),
  ]);
  const firms = tenants.filter((t) => !t.cfg.platform && t.status !== "cancelled");
  const consenting = firms.filter((t) => t.consent).length;
  const max = Math.max(1, ...learnings.map((l) => l.n));
  return (
    <PageContainer>
      <PageHeader eyebrow={<Link href="/platform/federation">Nakhla platform · Federation</Link>} title="Federation dashboard" subtitle="The data moat in one view: who contributes, how the pool grows, and how close each benchmark category is to its publication threshold." />
      <section className="mt-8 stat-row">
        <StatCard label="Consent rate" value={`${firms.length ? Math.round((consenting / firms.length) * 100) : 0}%`} note={`${consenting} of ${firms.length} active firms`} />
        <StatCard label="Learnings in the pool" value={String(stats.deals)} note={`from ${stats.advisories} advisories`} />
        <StatCard label="Published baselines" value={String(stats.baselines)} note={`k = ${MIN_DEALS} deals, ${MIN_ADVISORIES} firms`} />
        <StatCard label="Last aggregation" value={runs[0] ? formatDate(runs[0].createdAt) : "Never"} />
      </section>
      <Section title="Pool growth by quarter" description="Delivered mandates contributed as anonymised learnings.">
        <div className="flex h-40 items-end gap-2 rounded-md border border-hairline bg-surface p-4 shadow-card">
          {learnings.map((l) => (
            <div key={l.q} className="flex flex-1 flex-col items-center gap-1">
              <span className="num text-axis text-ink-700">{l.n}</span>
              <div className="w-full rounded-t-sm bg-navy-900" style={{ height: `${(l.n / max) * 100}px` }} />
              <span className="num text-axis text-ink-500">{l.q}</span>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Benchmark categories" description={`Publication needs ${MIN_FIRMS} firms and ${MIN_OBSERVATIONS} observations per benchmark.`}>
        <SimpleTable
          rows={bench}
          minWidth={720}
          columns={[
            { key: "c", header: "Category", cell: (b) => <span className="text-ink-900">{b.cat.replace(/_/g, " ")}</span> },
            { key: "t", header: "Benchmarks", numeric: true, cell: (b) => b.total },
            { key: "p", header: "Published", numeric: true, cell: (b) => b.published },
            { key: "f", header: "Firms (max)", numeric: true, cell: (b) => b.maxFirms },
            { key: "g", header: "Firms to threshold", cell: (b) => (b.maxFirms >= MIN_FIRMS ? <Flag tone="complete">Reached</Flag> : <Flag tone="progress">{`${MIN_FIRMS - b.maxFirms} more`}</Flag>) },
          ]}
        />
      </Section>
      <Section title="Firms">
        <SimpleTable
          rows={firms}
          minWidth={560}
          columns={[
            { key: "h", header: "Firm (anonymised)", cell: (t) => <span className="num">{t.id.slice(0, 8)}</span> },
            { key: "s", header: "Status", cell: (t) => t.status },
            { key: "c", header: "Federation", cell: (t) => <Flag tone={t.consent ? "complete" : "neutral"}>{t.consent ? "Contributing" : "Not opted in"}</Flag> },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
