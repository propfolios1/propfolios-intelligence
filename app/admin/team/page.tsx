import { asc, eq, inArray } from "drizzle-orm";
import { AddRecruit, RecruitStage } from "@/components/brokerage/actions";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import type { TargetMetric } from "@/db/schema-brokerage";
import { requireRole } from "@/lib/auth";
import { METRIC_LABEL, performance, quarter } from "@/lib/brokerage/team";
import { ensureHistory, periodOf, previousPeriods, teamView } from "@/lib/team/metrics";
import { PeriodPicker, Recompute } from "@/components/team/team";
import { LineSeries } from "@/components/charts/series";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { formatLocal } from "@/lib/format";
import { marketOf } from "@/lib/markets";
import { scope } from "@/lib/tenant-db";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Team and offices" };
export const dynamic = "force-dynamic";

const METRICS: TargetMetric[] = ["leads_converted", "listings_won", "deals_closed", "gci"];

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const q = quarter();
  await ensureHistory(db, user.tenantId, 6);
  const sp = (await searchParams).period;
  const periods = previousPeriods(periodOf(), 6);
  const period = sp && periods.includes(sp) ? sp : periods[0]!;
  const perf = await teamView(db, user.tenantId, period);
  const [offices, members, targets, recruits] = await Promise.all([
    db.select({ o: s.offices, head: s.users.name }).from(s.offices).leftJoin(s.users, eq(s.users.id, s.offices.headUserId)).where(scope(s.offices, user.tenantId)).orderBy(asc(s.offices.name)),
    db.select({ m: s.officeMembers, name: s.users.name, email: s.users.email }).from(s.officeMembers).innerJoin(s.users, eq(s.users.id, s.officeMembers.userId)).where(scope(s.officeMembers, user.tenantId)).orderBy(asc(s.users.name)),
    db.select().from(s.teamTargets).where(scope(s.teamTargets, user.tenantId, eq(s.teamTargets.period, q.label))),
    db.select({ r: s.recruits, office: s.offices.name }).from(s.recruits).leftJoin(s.offices, eq(s.offices.id, s.recruits.officeId)).where(scope(s.recruits, user.tenantId)).orderBy(asc(s.recruits.createdAt)),
  ]);
  const userIds = [...new Set(targets.map((t) => t.userId))];
  const names = userIds.length ? await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(inArray(s.users.id, userIds)) : [];
  const actual = await performance(db, user.tenantId, userIds, q.start, q.end);
  const cur = marketOf(offices[0]?.o.market).currency;
  const board = userIds.map((id) => ({ id, name: names.find((n) => n.id === id)?.name ?? "Former member", t: Object.fromEntries(METRICS.map((m) => [m, targets.find((x) => x.userId === id && x.metric === m)?.target ?? null])) as Record<TargetMetric, number | null>, a: actual.get(id)! }));
  const expiring = members.filter((m) => m.m.licenceExpiry && new Date(`${m.m.licenceExpiry}T00:00:00Z`).getTime() - Date.now() < 60 * 86_400_000);
  const onboarding = members.filter((m) => m.m.onboarding.some((x) => !x.done));
  const pipeline = recruits.filter((r) => !["hired", "declined"].includes(r.r.stage));
  const gciT = board.reduce((a, b) => a + (b.t.gci ?? 0), 0);
  const gciA = board.reduce((a, b) => a + b.a.gci, 0);
  const cell = (a: number, t: number | null, money = false) => (
    <span className={cn(t !== null && a >= t ? "text-success" : "text-ink-900")}>
      {money ? formatLocal(a, cur) : a}
      <span className="text-ink-400"> / {t === null ? "None" : money ? formatLocal(t, cur) : t}</span>
    </span>
  );
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Team and offices" subtitle={`Performance and coaching, offices, licences and onboarding, targets against what the records show for ${q.label}, and the recruiting pipeline.`} actions={<AddRecruit offices={offices.map((o) => ({ id: o.o.id, name: o.o.name }))} />} />
      <section className="my-8 stat-row">
        <StatCard label="Offices" value={String(offices.length)} note={`${members.length} licensed members`} />
        <StatCard label="Gross commission, quarter" value={formatLocal(gciA, cur)} note={gciT ? `${Math.round((gciA / gciT) * 100)}% of target` : "No target set"} />
        <StatCard label="Licences expiring" value={String(expiring.length)} note="Within 60 days" />
        <StatCard label="Candidates in pipeline" value={String(pipeline.length)} note={`${onboarding.length} members still onboarding`} />
      </section>
      <Section
        title="Performance"
        description="Computed from the records: leads, activity, viewings, listings, closed deals and commission credited through splits. Recomputed nightly; coaching flags compare each agent with the team's median for the month."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodPicker periods={periods} value={period} base="/admin/team" />
            <Recompute period={period} />
            <Button asChild variant="secondary">
              <a href={`/api/team/export?period=${period}`}>Export CSV</a>
            </Button>
            <Button asChild variant="secondary">
              <Link href={`/admin/team/coaching?period=${period}`}>Coaching{perf.snap?.flagged ? ` (${perf.snap.flagged})` : ""}</Link>
            </Button>
          </div>
        }
      >
        {perf.snap && (
          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            {(
              [
                ["gci", "Gross commission", (v: number) => formatLocal(v, cur)],
                ["conversionPct", "Lead conversion", (v: number) => `${v}%`],
                ["medianResponseHours", "Fastest first response", (v: number) => (v < 1 ? `${Math.round(v * 60)} min` : `${v} h`)],
              ] as const
            ).map(([k, label, fmt]) => (
              <div key={k} className="rounded-md border border-hairline bg-surface p-4">
                <div className="label-caps mb-2">{label}</div>
                <ol className="space-y-1.5 text-ui">
                  {(perf.snap!.leaderboards[k] ?? []).slice(0, 5).map((r) => (
                    <li key={r.userId} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">
                        <span className="num me-2 text-ink-400">{r.rank}</span>
                        <Link href={`/admin/team/${r.userId}?period=${period}`} className="text-ink-900 underline-offset-4 hover:underline">
                          {r.name}
                        </Link>
                      </span>
                      <span className="num shrink-0 text-ink-700">{fmt(r.value)}</span>
                    </li>
                  ))}
                  {!(perf.snap!.leaderboards[k] ?? []).length && <li className="text-ink-500">No results this month.</li>}
                </ol>
              </div>
            ))}
          </div>
        )}
        <SimpleTable
          rows={perf.rows}
          minWidth={1080}
          empty="No team activity recorded for this month."
          columns={[
            { key: "n", header: "Agent", cell: (r) => <Link href={`/admin/team/${r.a.userId}?period=${period}`} className="text-ink-900 underline-offset-4 hover:underline">{r.name}</Link> },
            { key: "g", header: "Commission", numeric: true, cell: (r) => formatLocal(r.a.metrics.gci, cur) },
            { key: "d", header: "Deals", numeric: true, cell: (r) => r.a.metrics.dealsClosed },
            { key: "l", header: "Leads", numeric: true, cell: (r) => r.a.metrics.leadsAssigned },
            { key: "c", header: "Conversion", numeric: true, cell: (r) => (r.a.metrics.conversionPct === null ? "None decided" : `${r.a.metrics.conversionPct}%`) },
            { key: "r", header: "First response", numeric: true, cell: (r) => (r.a.metrics.medianResponseHours === null ? "No data" : `${r.a.metrics.medianResponseHours} h`) },
            { key: "a", header: "Activity", numeric: true, cell: (r) => r.a.metrics.activities },
            { key: "v", header: "Viewings", numeric: true, cell: (r) => r.a.metrics.viewings },
            { key: "f", header: "Coaching", cell: (r) => (
              <span className="flex flex-wrap gap-1">
                {r.a.flags.filter((f) => f.kind === "concern").slice(0, 2).map((f) => <StatusPill key={f.key} tone={f.severity === "high" ? "error" : "progress"}>{f.title}</StatusPill>)}
                {r.a.flags.filter((f) => f.kind === "recognition").slice(0, 1).map((f) => <StatusPill key={f.key} tone="complete">{f.title}</StatusPill>)}
              </span>
            ) },
          ]}
        />
        {perf.trend.length > 1 && (
          <div className="mt-6 rounded-md border border-hairline bg-surface p-4">
            <div className="label-caps mb-3">Firm commission and deals, by month</div>
            <LineSeries data={perf.trend.map((t) => ({ month: t.period, gci: Math.round(t.totals.gci), deals: t.totals.dealsClosed }))} x="month" series={[{ key: "gci", label: "Commission" }]} height={220} />
          </div>
        )}
      </Section>
      <Section title={`Targets, ${q.label}`} description="Actuals are computed from the records: leads won, listings taken, deals closed and commission credited through splits.">
        <SimpleTable
          rows={board}
          minWidth={860}
          empty="No targets set for this quarter."
          columns={[
            { key: "n", header: "Member", cell: (b) => <span className="text-ink-900">{b.name}</span> },
            ...METRICS.map((m) => ({ key: m, header: METRIC_LABEL[m], numeric: true, cell: (b: (typeof board)[number]) => cell(b.a[m], b.t[m], m === "gci") })),
          ]}
        />
      </Section>
      <Section title="Offices">
        <SimpleTable
          rows={offices}
          minWidth={760}
          columns={[
            { key: "n", header: "Office", cell: (o) => <span className="text-ink-900">{o.o.name}</span> },
            { key: "m", header: "Market", cell: (o) => marketOf(o.o.market).name },
            { key: "a", header: "Address", cell: (o) => o.o.address },
            { key: "h", header: "Head", cell: (o) => o.head ?? "Not assigned" },
            { key: "c", header: "Members", numeric: true, cell: (o) => members.filter((m) => m.m.officeId === o.o.id).length },
          ]}
        />
      </Section>
      <Section title="Members" description={`Licence numbers follow each office's market: ${[...new Set(offices.map((o) => marketOf(o.o.market).agentLicence))].join("; ")}.`}>
        <SimpleTable
          rows={members}
          minWidth={980}
          columns={[
            { key: "n", header: "Member", cell: (m) => <span className="text-ink-900">{m.name}</span> },
            { key: "p", header: "Position", cell: (m) => m.m.position },
            { key: "o", header: "Office", cell: (m) => offices.find((o) => o.o.id === m.m.officeId)?.o.name ?? "None" },
            { key: "l", header: "Licence", cell: (m) => (m.m.licenceNumber ? <span className="num">{m.m.licenceNumber}</span> : "Not on file") },
            { key: "e", header: "Expires", cell: (m) => (m.m.licenceExpiry ? <span className={cn(expiring.includes(m) && "text-danger")}>{formatDate(m.m.licenceExpiry)}</span> : "Not on file") },
            { key: "ob", header: "Onboarding", numeric: true, cell: (m) => `${m.m.onboarding.filter((x) => x.done).length} of ${m.m.onboarding.length}` },
            { key: "s", header: "Started", cell: (m) => (m.m.startedOn ? formatDate(m.m.startedOn) : "Not on file") },
          ]}
        />
      </Section>
      <Section title="Recruiting">
        <SimpleTable
          rows={recruits}
          minWidth={900}
          empty="No candidates yet."
          columns={[
            { key: "n", header: "Candidate", cell: (r) => <span className="text-ink-900">{r.r.name}</span> },
            { key: "r", header: "Role", cell: (r) => r.r.role },
            { key: "o", header: "Office", cell: (r) => r.office ?? "Any" },
            { key: "x", header: "Experience", numeric: true, cell: (r) => (r.r.experienceYears === null ? "Not stated" : `${r.r.experienceYears} yrs`) },
            { key: "src", header: "Source", cell: (r) => r.r.source },
            { key: "st", header: "Stage", cell: (r) => (r.r.stage === "hired" ? <Flag tone="complete">Hired</Flag> : <RecruitStage id={r.r.id} stage={r.r.stage} />) },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
