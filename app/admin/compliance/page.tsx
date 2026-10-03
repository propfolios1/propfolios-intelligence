import { and, desc, eq, gte, isNotNull } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { ConsentToggle, DataRequestForm, ExportButton, RetentionForm, StepButton } from "@/components/fabric/compliance-actions";
import { Flag, Severity } from "@/components/os/badges";
import { RunAgent } from "@/components/os/run-agent";
import { activeTab, SectionTabs } from "@/components/os/section-tabs";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { DEFAULT_RETENTION, RESPONSE_DAYS } from "@/lib/os/compliance";
import { scanDataQuality } from "@/lib/os/data-quality";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Compliance" };
export const dynamic = "force-dynamic";

const TABS = [
  ["requests", "Data requests"],
  ["consents", "Consents"],
  ["retention", "Retention"],
  ["quality", "Data quality"],
  ["audit", "Audit narration"],
] as const;

const PURPOSES = [
  ["data_processing", "Processing"],
  ["cross_border_transfer", "Cross-border transfer"],
  ["federation", "Federation"],
  ["marketing", "Marketing"],
] as const;

const STATUS_TONE = { received: "neutral", verified: "progress", in_progress: "progress", completed: "complete", rejected: "error" } as const;

export default async function Compliance({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const tab = activeTab(TABS, (await searchParams).tab);
  const db = await getDb();
  const [requests, clients, consents, tenant, portal] = await Promise.all([
    db.select().from(s.dataRequests).where(scope(s.dataRequests, user.tenantId)).orderBy(desc(s.dataRequests.createdAt)),
    db.select({ id: s.clients.id, name: s.clients.name, domicile: s.clients.domicile }).from(s.clients).where(scope(s.clients, user.tenantId)).orderBy(s.clients.name),
    db.select().from(s.consents).where(scope(s.consents, user.tenantId)),
    db.select({ cfg: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.id, user.tenantId)),
    db.select({ clientId: s.users.clientId, email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, user.tenantId), isNotNull(s.users.clientId))),
  ]);
  const emailOf = new Map(portal.map((p) => [p.clientId, p.email]));
  const consentOf = new Map(consents.map((c) => [`${c.clientId}:${c.purpose}`, c]));
  const retention = tenant[0]?.cfg.retention ?? DEFAULT_RETENTION;
  const open = requests.filter((r) => r.status !== "completed" && r.status !== "rejected");
  const overdue = open.filter((r) => r.dueAt < new Date());
  const jurisdiction = (domicile: string): "UAE" | "India" | "EU" => (/India/i.test(domicile) ? "India" : /UAE|Dubai|Abu Dhabi|Emirates/i.test(domicile) ? "UAE" : /UK|United Kingdom|France|Germany|Ireland|Netherlands|EU/i.test(domicile) ? "EU" : "UAE");

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration · Governance"
        title="Compliance"
        subtitle="Data subject requests under the UAE PDPL, India's DPDP Act and the GDPR, consent by purpose, retention by jurisdiction, and the integrity of the records the firm relies on."
      />
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open requests" value={String(open.length)} note={`${RESPONSE_DAYS["UAE PDPL"]}-day statutory response`} />
        <StatCard label="Past due" value={String(overdue.length)} note={overdue.length ? "Respond today" : "All within deadline"} />
        <StatCard label="Consents recorded" value={String(consents.length)} note={`${consents.filter((c) => c.granted).length} granted`} />
        <StatCard label="Audit retention" value={`${retention.auditYears} years`} />
      </section>
      <div className="mt-10">
        <SectionTabs base="/admin/compliance" tabs={TABS} active={tab} label="Compliance sections" />
      </div>

      {tab === "requests" && (
        <>
          <Section title="Log a request" description="Requests are acknowledged on receipt; the due date follows the regime. Deletion keeps the records that AML and tax law require, in pseudonymised form, until their retention period ends.">
            <DataRequestForm clients={clients.map((c) => ({ id: c.id, name: c.name, email: emailOf.get(c.id) ?? null }))} />
          </Section>
          <Section title="Requests">
            <div className="space-y-4">
              {requests.length === 0 && <p className="rounded-lg border border-ink-200 bg-surface px-6 py-10 text-center text-small text-ink-500">No data subject requests have been received.</p>}
              {requests.map((r) => {
                const next = r.steps.findIndex((x) => !x.done);
                const client = clients.find((c) => c.id === r.clientId);
                return (
                  <article key={r.id} className="rounded-lg border border-ink-200 bg-surface p-5 shadow-card">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-body font-medium text-ink-900">
                          {r.type[0]!.toUpperCase() + r.type.slice(1)} request · {r.regime}
                        </div>
                        <div className="mt-1 text-small text-ink-500">
                          {client?.name ?? r.subjectEmail} · received <RelativeTime iso={r.createdAt.toISOString()} /> · due <span className="num">{formatDate(r.dueAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {r.dueAt < new Date() && next >= 0 && <Flag tone="error">Past due</Flag>}
                        <Flag tone={STATUS_TONE[r.status]}>{r.status.replace("_", " ")}</Flag>
                        {r.clientId && (r.type === "access" || r.type === "portability") && <ExportButton clientId={r.clientId} />}
                      </div>
                    </div>
                    <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {r.steps.map((x, i) => (
                        <li key={i} className={"rounded-md border px-3 py-2.5 text-small " + (x.done ? "border-success/20 bg-success/5 text-ink-700" : i === next ? "border-navy-700/30 bg-navy-50 text-ink-900" : "border-ink-200 text-ink-500")}>
                          <div className="flex items-baseline gap-2">
                            <span className="num text-axis text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                            <span>{x.step}</span>
                          </div>
                          {x.done && x.at && <div className="num mt-1 text-[12px] text-ink-500">Completed {formatDate(new Date(x.at))}</div>}
                          {i === next && (
                            <div className="mt-2">
                              <StepButton requestId={r.id} index={i} label={/Erase/.test(x.step) ? "Erase personal data" : "Mark complete"} destructive={/Erase/.test(x.step)} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  </article>
                );
              })}
            </div>
          </Section>
        </>
      )}

      {tab === "consents" && (
        <Section title="Consent register" description="One record per client and purpose, versioned against the current privacy notice (2026-04). Select a status to record a grant or a withdrawal; each change is audited.">
          <SimpleTable
            rows={clients}
            minWidth={880}
            empty="No clients."
            columns={[
              { key: "n", header: "Client", cell: (c) => <span className="text-ink-900">{c.name}</span> },
              { key: "j", header: "Regime", cell: (c) => jurisdiction(c.domicile) },
              ...PURPOSES.map(([p, label]) => ({
                key: p,
                header: label,
                cell: (c: (typeof clients)[number]) => <ConsentToggle clientId={c.id} purpose={p} granted={consentOf.get(`${c.id}:${p}`)?.granted ?? null} jurisdiction={consentOf.get(`${c.id}:${p}`)?.jurisdiction ?? jurisdiction(c.domicile)} />,
              })),
            ]}
          />
        </Section>
      )}

      {tab === "retention" && (
        <>
          <Section title="Retention policy" description="How long records are kept after a relationship ends. Deletion requests inside these periods pseudonymise rather than delete regulated records.">
            <RetentionForm initial={retention} />
          </Section>
          <Section title="What is retained, and why">
            <SimpleTable
              rows={[
                { r: "KYC file and screening results", b: "UAE AML Decree-Law 20 of 2018, Art. 16; India PMLA s.12", p: `${Math.max(retention.uaeYears, retention.indiaYears)} years from end of relationship` },
                { r: "Invoices, payments, commissions", b: "UAE VAT Law Art. 78; India CGST s.36", p: "Five years (UAE), six years (India)" },
                { r: "Audit trail", b: "Firm policy; supports regulatory inspection", p: `${retention.auditYears} years` },
                { r: "Messages and non-regulated documents", b: "Purpose limitation (PDPL Art. 5, DPDP s.8(7), GDPR Art. 5(1)(e))", p: "Deleted on request or at relationship end" },
                { r: "EU residents' personal data", b: "GDPR Art. 17, storage limitation", p: `${retention.euYears} years` },
              ]}
              minWidth={760}
              columns={[
                { key: "r", header: "Record", cell: (x) => <span className="text-ink-900">{x.r}</span> },
                { key: "b", header: "Basis", cell: (x) => x.b },
                { key: "p", header: "Period", cell: (x) => x.p },
              ]}
            />
          </Section>
        </>
      )}

      {tab === "quality" && <QualityTab tenantId={user.tenantId} />}

      {tab === "audit" && <AuditTab tenantId={user.tenantId} />}
    </PageContainer>
  );
}

async function QualityTab({ tenantId }: { tenantId: string }) {
  const db = await getDb();
  const [checks, last] = await Promise.all([scanDataQuality(db, tenantId), lastOutput(tenantId, "data-quality-agent", null)]);
  return (
    <>
      <Section title="Record checks" description="Gaps that weaken agents, compliance or reporting, counted live.">
        <SimpleTable
          rows={checks}
          minWidth={900}
          columns={[
            { key: "c", header: "Check", cell: (c) => <span className="text-ink-900">{c.check}</span> },
            { key: "s", header: "Severity", cell: (c) => <Severity level={c.severity} /> },
            { key: "n", header: "Records", numeric: true, cell: (c) => c.count },
            { key: "e", header: "Examples", cell: (c) => c.examples.join(", ") || "None" },
            { key: "f", header: "Fix", cell: (c) => c.fix },
          ]}
        />
      </Section>
      <Section title="Data quality agent" description="Scores the workspace and orders the fixes by their effect on compliance and agent accuracy.">
        <RunAgent endpoint="/api/compliance/data-quality" body={{}} agentLabel="Data quality agent" action="Score workspace" initial={last} />
      </Section>
    </>
  );
}

async function AuditTab({ tenantId }: { tenantId: string }) {
  const db = await getDb();
  const since = new Date(Date.now() - 7 * 86_400_000);
  const [rows, last] = await Promise.all([
    db.select().from(s.auditLogs).where(scope(s.auditLogs, tenantId, gte(s.auditLogs.createdAt, since))).orderBy(desc(s.auditLogs.createdAt)).limit(40),
    lastOutput(tenantId, "audit-narrator", "Workspace, last 7 days"),
  ]);
  return (
    <>
      <Section title="Audit narration" description="The audit narrator reads the last seven days of the trail and writes it up for a compliance officer: what happened, what matters, what looks unusual.">
        <RunAgent endpoint="/api/compliance/narrate" body={{ days: 7 }} agentLabel="Audit narrator" action="Narrate last seven days" initial={last} />
      </Section>
      <Section title="Recent entries" description="Every mutation records the actor, before and after state, IP address, user agent and request identifier.">
        <SimpleTable
          rows={rows}
          minWidth={980}
          empty="No entries in the last seven days."
          columns={[
            { key: "w", header: "When", cell: (r) => <RelativeTime iso={r.createdAt.toISOString()} /> },
            { key: "a", header: "Actor", cell: (r) => r.actorName },
            { key: "x", header: "Action", cell: (r) => <span className="text-ink-900">{r.action}</span> },
            { key: "e", header: "Entity", cell: (r) => r.entityType ?? "" },
            { key: "i", header: "IP", cell: (r) => <span className="num">{r.ip ?? "System"}</span> },
            { key: "q", header: "Request", cell: (r) => <span className="num text-[12px]">{r.requestId?.slice(0, 8) ?? ""}</span> },
            { key: "d", header: "Change", cell: (r) => (r.before || r.after ? "Before and after recorded" : "") },
          ]}
        />
      </Section>
    </>
  );
}
