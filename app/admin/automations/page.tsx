import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { AutomationBuilder, AutomationToggle } from "@/components/fabric/automation-builder";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Automations" };
export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = { "deal.closed": "Deal closes", "deal.stage_changed": "Deal changes stage", "mandate.created": "Mandate created", "invoice.paid": "Invoice paid", "commission.computed": "Commission computed", "kyc.expired": "KYC expires" };

export default async function Automations() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [rules, runs] = await Promise.all([
    db.select().from(s.automations).where(scope(s.automations, user.tenantId)).orderBy(desc(s.automations.createdAt)),
    db.select({ r: s.automationRuns, name: s.automations.name }).from(s.automationRuns).innerJoin(s.automations, eq(s.automations.id, s.automationRuns.automationId)).where(scope(s.automationRuns, user.tenantId)).orderBy(desc(s.automationRuns.createdAt)).limit(30),
  ]);
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Operations" title="Automations" subtitle="When something happens, check conditions, then act: notify the team, email, create a task, generate a report or post to Slack. Every run is recorded, matched or not." />
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Automations" value={String(rules.length)} note={`${rules.filter((r) => r.enabled).length} enabled`} />
        <StatCard label="Runs recorded" value={String(rules.reduce((a, r) => a + r.runCount, 0))} />
        <StatCard label="Last 30 runs: acted" value={String(runs.filter((r) => r.r.status === "succeeded").length)} />
        <StatCard label="Last 30 runs: failed" value={String(runs.filter((r) => r.r.status === "failed").length)} />
      </section>
      <Section title="New automation">
        <AutomationBuilder />
      </Section>
      <Section title="Automations">
        <SimpleTable
          rows={rules}
          minWidth={1000}
          empty="No automations yet."
          columns={[
            { key: "n", header: "Name", cell: (r) => <span className="text-ink-900">{r.name}</span> },
            { key: "t", header: "When", cell: (r) => TRIGGER_LABEL[r.trigger] ?? r.trigger },
            { key: "c", header: "Only if", cell: (r) => (r.conditions.length ? r.conditions.map((c) => `${c.field.replace(/_/g, " ")} ${c.op === "eq" ? "is" : c.op === "gt" ? ">" : c.op === "lt" ? "<" : "contains"} ${c.value}`).join("; ") : "Always") },
            { key: "a", header: "Then", cell: (r) => r.actions.map((a) => a.type.replace(/_/g, " ")).join(", ") },
            { key: "r", header: "Runs", numeric: true, cell: (r) => r.runCount },
            { key: "s", header: "Status", cell: (r) => <Flag tone={r.enabled ? "complete" : "neutral"}>{r.enabled ? "Enabled" : "Paused"}</Flag> },
            { key: "x", header: "", cell: (r) => <AutomationToggle id={r.id} enabled={r.enabled} /> },
          ]}
        />
      </Section>
      <Section title="Recent runs">
        <SimpleTable
          rows={runs}
          minWidth={820}
          empty="No runs yet."
          columns={[
            { key: "w", header: "When", cell: (r) => <RelativeTime iso={r.r.createdAt.toISOString()} /> },
            { key: "n", header: "Automation", cell: (r) => r.name },
            { key: "s", header: "Outcome", cell: (r) => <Flag tone={r.r.status === "succeeded" ? "complete" : r.r.status === "failed" ? "error" : "neutral"}>{r.r.status}</Flag> },
            { key: "d", header: "Detail", cell: (r) => (r.r.detail.actions.length ? r.r.detail.actions.map((a) => `${a.type.replace(/_/g, " ")}: ${a.result}`).join("; ") : (r.r.detail.reason ?? "")) },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
