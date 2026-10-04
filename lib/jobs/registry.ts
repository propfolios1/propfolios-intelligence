/**
 * Every scheduled job on the platform. Supabase Cron (pg_cron) holds the
 * schedule; HTTP jobs call a Supabase Edge Function of the same name through
 * pg_net, and the function relays to /api/jobs/<job> on the application. SQL
 * jobs run inside the database. Vercel Cron is not used.
 */
export type JobDef = {
  name: string;
  schedule: string;
  label: string;
  description: string;
} & ({ kind: "sql"; sql: string } | { kind: "http"; fn: string });

export const JOBS: JobDef[] = [
  { name: "keep-alive", schedule: "0 */6 * * *", label: "Keep-alive", description: "A trivial query every six hours, so a free-tier Supabase project is never paused for inactivity (which would stop every other job).", kind: "sql", sql: "SELECT 1" },
  { name: "trial-lifecycle", schedule: "0 * * * *", label: "Trial lifecycle", description: "Moves trials from full access to read-only (day 14), soft-deleted (day 30) and purged (day 60), and sends the day 10, 13, 14 and 29 notices.", kind: "http", fn: "trial-lifecycle" },
  { name: "developer-sync", schedule: "0 */6 * * *", label: "Developer inventory sync", description: "Reads unit availability and prices from each connected developer feed.", kind: "http", fn: "developer-sync" },
  { name: "portal-publish-poll", schedule: "*/15 * * * *", label: "Portal publishing", description: "Sends queued listing publishes, updates and removals to the portals and polls the status of earlier ones.", kind: "http", fn: "portal-publish-poll" },
  { name: "proactive-insights", schedule: "0 * * * *", label: "Proactive insights", description: "The insight agent scans every active and trial firm: price movements over 10%, developer distress, undervalued stock and exit windows.", kind: "http", fn: "insight-agent" },
  { name: "federation-aggregate", schedule: "0 2 * * *", label: "Federation aggregation", description: "Aggregates anonymised learnings from opted-in firms into the published benchmarks.", kind: "http", fn: "federation-aggregate" },
  { name: "job-run-details-cleanup", schedule: "0 0 * * *", label: "Cron history cleanup", description: "Deletes pg_cron run history older than seven days.", kind: "sql", sql: "delete from cron.job_run_details where end_time < now() - interval '7 days'" },
  { name: "whatsapp-dispatch", schedule: "* * * * *", label: "WhatsApp dispatch", description: "Sends queued WhatsApp messages and broadcasts within each firm's per-minute throttle, and refreshes broadcast totals.", kind: "http", fn: "whatsapp-dispatch" },
  { name: "compliance-monitoring", schedule: "30 1 * * *", label: "Compliance monitoring", description: "Re-screens subjects whose review date has passed, expires lapsed KYC, flags reports past their deadline and deletes records past the seven-year retention period.", kind: "http", fn: "compliance-monitoring" },
  { name: "team-snapshots", schedule: "15 0 * * *", label: "Team performance", description: "Recomputes each agent's metrics and coaching flags for the month, and the firm's leaderboards and medians.", kind: "http", fn: "team-snapshots" },
  { name: "marketing-dispatch", schedule: "*/5 * * * *", label: "Marketing automation", description: "Enrols new leads into sequences, promotes new and reduced listings, sends due email and WhatsApp steps and publishes scheduled social posts.", kind: "http", fn: "marketing-dispatch" },
  { name: "portfolio-monitor", schedule: "0 4 * * *", label: "Portfolio monitor", description: "Daily holding alerts for every client; on Mondays, the weekly digest.", kind: "http", fn: "portfolio-monitor" },
  { name: "client-servicing", schedule: "0 3 * * *", label: "Client servicing", description: "Overdue invoices, KYC reminders, statements, quarterly reports, wallet share and tax documents on their dates.", kind: "http", fn: "client-servicing" },
  { name: "developer-risk", schedule: "0 5 * * 1", label: "Developer risk", description: "Weekly re-scoring of every developer's risk score and breakdown.", kind: "http", fn: "developer-risk" },
  { name: "bi-nightly", schedule: "0 23 * * *", label: "Benchmarks and reports", description: "Nightly benchmarks and firm metrics; market pulses on the 1st and outlooks each quarter.", kind: "http", fn: "bi-nightly" },
];

export const JOB_INDEX: Record<string, JobDef> = Object.fromEntries(JOBS.map((j) => [j.name, j]));
/** Edge function name to job name (proactive-insights is served by the insight-agent function). */
export const JOB_BY_FN: Record<string, JobDef> = Object.fromEntries(JOBS.filter((j): j is JobDef & { kind: "http" } => j.kind === "http").map((j) => [j.fn, j]));
