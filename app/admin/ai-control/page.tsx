import { and, eq, gte, sql } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { AiControlPanel } from "@/components/fabric/ai-control";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { agentCatalogue, agentUsage, COST_CEILING_USD } from "@/lib/ai/usage";

export const metadata = { title: "AI control" };
export const dynamic = "force-dynamic";

export default async function AiControl() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [usage, [tenant], [month]] = await Promise.all([
    agentUsage(db, user.tenantId),
    db.select({ cfg: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.id, user.tenantId)),
    db
      .select({ usd: sql<number>`coalesce(sum(${s.auditLogs.costUsd}), 0)::float8`, runs: sql<number>`count(*)::int` })
      .from(s.auditLogs)
      .where(and(eq(s.auditLogs.tenantId, user.tenantId), eq(s.auditLogs.actorType, "agent"), gte(s.auditLogs.createdAt, monthStart))),
  ]);
  const ai = tenant?.cfg.ai ?? { disabledAgents: [], monthlyBudgetUsd: null };
  const rows = agentCatalogue().map((a) => {
    const u = usage.get(a.name);
    return { number: a.number, name: a.name, label: a.label, module: a.module, model: a.model, essential: a.essential, runs: u?.runs ?? 0, avgUsd: u?.avgLiveUsd ?? null, estimateUsd: a.estimateUsd };
  });
  const costs = rows.map((r) => r.avgUsd ?? r.estimateUsd).filter((c): c is number => c !== null);
  const over = costs.filter((c) => c > COST_CEILING_USD).length;
  const spend = month?.usd ?? 0;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration · Governance"
        title="AI control"
        subtitle={`Forty-five agents work for this firm. Switch any vertical agent off, set a monthly budget and test-run an agent on representative input before relying on it. The pipeline agents that produce mandates cannot be switched off. Every run is held to an average below $${COST_CEILING_USD.toFixed(2)}.`}
      />
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Spend this month" value={`$${spend.toFixed(2)}`} note={ai.monthlyBudgetUsd ? `of $${ai.monthlyBudgetUsd.toLocaleString("en-US")} budget` : "No budget set"} />
        <StatCard label="Agent runs this month" value={String(month?.runs ?? 0)} />
        <StatCard label="Agents switched off" value={String(ai.disabledAgents.length)} />
        <StatCard label={`Above $${COST_CEILING_USD.toFixed(2)} per run`} value={String(over)} note={over ? "Review the prompt or model tier" : "All agents within the ceiling"} />
      </section>
      <Section title="Agents" description="Average cost uses live runs from the audit trail; where an agent has only run in replay, the estimate is computed from its prompt, tool schema and a representative output at its model tier.">
        <AiControlPanel rows={rows} disabled={ai.disabledAgents} budget={ai.monthlyBudgetUsd} ceiling={COST_CEILING_USD} />
      </Section>
    </PageContainer>
  );
}
