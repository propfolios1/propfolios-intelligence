import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { RunNow } from "@/components/jobs/run-now";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb, hasExternalDb } from "@/db";
import { cronJobs } from "@/lib/jobs/cron";
import { JOBS } from "@/lib/jobs/registry";
import { recentRuns } from "@/lib/jobs/runner";


const when = (iso: string | Date | null | undefined) => (iso ? new Date(iso).toISOString().slice(0, 16).replace("T", " ") : "Never");

/** Scheduled jobs from the registry, pg_cron (cron.job, cron.job_run_details) and job_runs. */
export async function HealthView({ platformAdmin, eyebrow }: { platformAdmin: boolean; eyebrow: string }) {
  const db = await getDb();
  const [cron, runs] = await Promise.all([cronJobs(db).catch(() => null), recentRuns(db, undefined, 400)]);
  const dayAgo = Date.now() - 86_400_000;
  const rows = JOBS.map((j) => {
    const c = cron?.find((x) => x.jobname === j.name) ?? null;
    const mine = runs.filter((r) => r.job === j.name);
    const last = mine[0] ?? null;
    const appFailures = mine.filter((r) => r.status === "failed" && r.startedAt.getTime() > dayAgo).length;
    return { j, c, last, failures: (c?.failures24h ?? 0) + appFailures };
  });
  const failing = rows.filter((r) => r.failures > 0 || r.c?.lastStatus === "failed" || r.last?.status === "failed");
  const keepAlive = cron?.find((c) => c.jobname === "keep-alive");
  return (
    <PageContainer>
      <PageHeader eyebrow={eyebrow} title="System health" subtitle="Scheduled jobs run on Supabase Cron. Each HTTP job calls an edge function, which relays to the application and records the run; SQL jobs run inside the database." />
      <section className="my-8 stat-row">
        <StatCard label="Scheduled in pg_cron" value={cron ? `${cron.length} of ${JOBS.length}` : "Not available"} note={cron ? "From cron.job" : hasExternalDb() ? "pg_cron is not enabled on this database" : "Embedded demonstration database"} />
        <StatCard label="Failures, 24 hours" value={String(failing.reduce((a, r) => a + r.failures, 0))} note={failing.length ? failing.map((f) => f.j.label).join(", ") : "No failed runs"} />
        <StatCard label="Keep-alive" value={keepAlive ? (keepAlive.lastStatus === "succeeded" ? "Running" : keepAlive.lastStatus ?? "Scheduled") : "Not scheduled"} note={keepAlive ? `Last ${when(keepAlive.lastStart)} UTC` : "Run setup on Supabase to schedule it"} />
        <StatCard label="Runs recorded" value={String(runs.length)} note="Most recent 400 in job_runs" />
      </section>
      {failing.length > 0 && (
        <div role="alert" className="mb-8 rounded-md border border-danger/30 bg-danger/5 p-4 text-ui text-ink-900">
          {failing.length === 1 ? "One job has" : `${failing.length} jobs have`} failed in the last 24 hours: {failing.map((f) => `${f.j.label}${f.last?.error ? ` (${f.last.error.slice(0, 120)})` : f.c?.lastMessage ? ` (${f.c.lastMessage.slice(0, 120)})` : ""}`).join("; ")}.
        </div>
      )}
      <Section title="Scheduled jobs" description="Schedules are UTC cron expressions. Database run is the latest pg_cron execution (for HTTP jobs, the request dispatch); application run is the latest execution recorded by the job itself.">
        <SimpleTable
          rows={rows}
          minWidth={1100}
          columns={[
            { key: "n", header: "Job", cell: (r) => <span title={r.j.description} className="text-ink-900">{r.j.label}</span> },
            { key: "s", header: "Schedule", cell: (r) => <code className="num text-[12px]">{r.c?.schedule ?? r.j.schedule}</code> },
            { key: "k", header: "Runs as", cell: (r) => (r.j.kind === "sql" ? "SQL" : `Edge function ${r.j.fn}`) },
            { key: "c", header: "Database run", cell: (r) => (r.c ? <span>{when(r.c.lastStart)} <Flag tone={r.c.lastStatus === "failed" ? "error" : r.c.lastStatus === "succeeded" ? "complete" : "neutral"}>{r.c.lastStatus ?? (r.c.active ? "scheduled" : "paused")}</Flag></span> : <span className="text-ink-500">Not scheduled</span>) },
            { key: "a", header: "Application run", cell: (r) => (r.last ? <span>{when(r.last.startedAt)} <Flag tone={r.last.status === "failed" ? "error" : r.last.status === "succeeded" ? "complete" : "progress"}>{r.last.status}</Flag></span> : <span className="text-ink-500">{r.j.kind === "sql" ? "Runs in the database" : "Never"}</span>) },
            { key: "d", header: "Duration", numeric: true, cell: (r) => (r.last?.durationMs != null ? `${(r.last.durationMs / 1000).toFixed(1)} s` : "") },
            { key: "f", header: "Failures 24 h", numeric: true, cell: (r) => <span className={r.failures ? "text-danger" : ""}>{r.failures}</span> },
            { key: "r", header: "", cell: (r) => <RunNow job={r.j.name} label={r.j.label} allowed={platformAdmin} /> },
          ]}
        />
      </Section>
      <Section title="Recent runs">
        <SimpleTable
          rows={runs.slice(0, 30)}
          minWidth={900}
          empty="No job has run yet."
          columns={[
            { key: "j", header: "Job", cell: (r) => JOBS.find((j) => j.name === r.job)?.label ?? r.job },
            { key: "t", header: "Trigger", cell: (r) => (r.trigger === "manual" ? `Manual, ${r.actor ?? ""}` : "Supabase Cron") },
            { key: "s", header: "Started", cell: (r) => `${when(r.startedAt)} UTC` },
            { key: "st", header: "Status", cell: (r) => <Flag tone={r.status === "failed" ? "error" : r.status === "succeeded" ? "complete" : "progress"}>{r.status}</Flag> },
            { key: "d", header: "Duration", numeric: true, cell: (r) => (r.durationMs != null ? `${(r.durationMs / 1000).toFixed(1)} s` : "") },
            { key: "e", header: "Detail", cell: (r) => r.error ?? (r.result ? Object.entries(r.result).filter(([, v]) => typeof v !== "object").slice(0, 3).map(([k, v]) => `${k} ${v}`).join(", ") : "") },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
