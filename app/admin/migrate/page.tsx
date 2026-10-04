import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { MigrationWizard, NewImport, type WizardData } from "@/components/migration/wizard";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { MARKET_CODES, MARKETS } from "@/lib/markets";
import { fieldsFor } from "@/lib/migration/fields";
import { distinctValues, getJob, jobLogs, listJobs, preview, rules } from "@/lib/migration/engine";
import { oauthConfigured, SOURCE_LIST, SOURCES } from "@/lib/migration/sources";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Data migration" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; tone: "neutral" | "progress" | "complete" | "error" }> = {
  connecting: { label: "Awaiting connection", tone: "neutral" },
  extracting: { label: "Reading source", tone: "progress" },
  mapping: { label: "Mapping fields", tone: "progress" },
  dry_run: { label: "Dry run", tone: "progress" },
  ready: { label: "Ready to load", tone: "progress" },
  running: { label: "Loading", tone: "progress" },
  completed: { label: "Completed", tone: "complete" },
  failed: { label: "Failed", tone: "error" },
  rolled_back: { label: "Rolled back", tone: "neutral" },
};

export default async function MigratePage({ searchParams }: { searchParams: Promise<{ job?: string; error?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const sp = await searchParams;
  const jobs = await listJobs(db, user.tenantId);
  let data: WizardData | null = null;
  if (sp.job) {
    const job = await getJob(db, user.tenantId, sp.job);
    const [r, logs, sample] = await Promise.all([rules(db, job.id), jobLogs(db, job.id, 120), job.extracted ? preview(db, job) : Promise.resolve([])]);
    const values = Object.fromEntries(await Promise.all(r.filter((x) => x.transform === "value_map").map(async (x) => [x.sourceField, await distinctValues(db, job.id, x.sourceField)] as const)));
    const a = SOURCES[job.source];
    data = {
      job: { id: job.id, reference: job.reference, source: job.source, entity: job.entity, status: job.status, account: job.account, connected: Boolean(job.credentials), extracted: job.extracted, fileName: job.fileName, sourceFields: job.sourceFields, totals: job.totals, dryRunTotals: job.dryRunTotals, error: job.error, rollbackUntil: job.rollbackUntil?.toISOString() ?? null, finishedAt: job.finishedAt?.toISOString() ?? null, defaultMarket: job.defaultMarket },
      source: { name: a.name, auth: a.auth, guide: a.guide, configured: a.auth !== "oauth2" || oauthConfigured(a), env: a.oauth ? [a.oauth.clientIdEnv, a.oauth.clientSecretEnv] : [] },
      targets: fieldsFor(job.entity).map((f) => ({ key: f.key, label: f.label, required: Boolean(f.required), transform: f.transform, hint: f.hint ?? null })),
      rules: r,
      values,
      preview: sample.map((p) => ({ rowNumber: p.rowNumber, ok: p.result.ok, record: p.result.ok ? (p.result.record as Record<string, unknown>) : null, errors: p.result.ok ? [] : p.result.errors, warnings: p.result.warnings })),
      logs: logs.map((l) => ({ id: l.id, level: l.level, phase: l.phase, rowNumber: l.rowNumber, message: l.message, at: l.occurredAt.toISOString() })),
      error: sp.error ?? null,
    };
  }
  const done = jobs.filter((j) => j.status === "completed");
  const created = done.reduce((a, j) => a + j.totals.created, 0);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Data migration"
        subtitle="Bring leads and listings over from Follow Up Boss, Salesforce, HubSpot, Zoho, Propertybase, kvCORE or any CSV export. Every import maps fields, runs a dry run first, loads in batches and can be rolled back for 24 hours."
        actions={<NewImport sources={SOURCE_LIST.map((s) => ({ key: s.key, name: s.name, auth: s.auth, entities: s.entities, guide: s.guide, configured: s.auth !== "oauth2" || oauthConfigured(s) }))} markets={MARKET_CODES.map((c) => ({ code: c, name: MARKETS[c].name }))} />}
      />
      {data ? (
        <MigrationWizard data={data} />
      ) : (
        <section className="my-8 stat-row">
          <StatCard label="Imports" value={String(jobs.length)} note={`${done.length} completed`} />
          <StatCard label="Records created" value={created.toLocaleString("en-US")} note="Across completed imports" />
          <StatCard label="In progress" value={String(jobs.filter((j) => !["completed", "failed", "rolled_back"].includes(j.status)).length)} note="Awaiting mapping or loading" />
          <StatCard label="Rollback available" value={String(done.filter((j) => j.rollbackUntil && j.rollbackUntil.getTime() > Date.now()).length)} note="Within 24 hours of completion" />
        </section>
      )}
      <Section title="Imports" description="Each import keeps its mapping, its dry-run findings and a log of every rejected row.">
        <SimpleTable
          rows={jobs}
          minWidth={860}
          empty="No imports yet. Choose New import to bring your CRM data across."
          columns={[
            {
              key: "r",
              header: "Import",
              cell: (j) => (
                <Link href={`/admin/migrate?job=${j.id}`} className="text-ink-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
                  {j.reference}
                </Link>
              ),
            },
            { key: "s", header: "Source", cell: (j) => `${SOURCES[j.source].name}${j.fileName ? ` · ${j.fileName}` : j.account ? ` · ${j.account}` : ""}` },
            { key: "e", header: "Records", cell: (j) => (j.entity === "listings" ? "Listings" : "Leads") },
            { key: "st", header: "Status", cell: (j) => <Flag tone={STATUS[j.status]!.tone}>{STATUS[j.status]!.label}</Flag> },
            { key: "n", header: "Staged", numeric: true, cell: (j) => j.totals.staged.toLocaleString("en-US") },
            { key: "c", header: "Created", numeric: true, cell: (j) => j.totals.created.toLocaleString("en-US") },
            { key: "d", header: "Started", cell: (j) => formatDate(j.createdAt) },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
