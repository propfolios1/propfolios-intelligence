import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { AgentOutput } from "@/components/os/agent-output";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { portalServicing } from "@/lib/client/portal";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Goals" };
export const dynamic = "force-dynamic";

export default async function ClientGoals() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const p = await portalServicing(await getDb(), user);
  const tracker = p ? await lastOutput(user.tenantId, "goal-tracker", p.client.id) : null;
  return (
    <PageContainer>
      <PageHeader eyebrow="Planning" title="Your goals" subtitle="The objectives you set with your advisers, measured against your portfolio as it stands today." />
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {!p?.goals.length && <EmptyState glyph="opportunities" headline="No goals set yet. Your adviser will agree them with you at your next review." />}
        {p?.goals.map((g) => (
          <article key={g.id} className="rounded-md border border-hairline bg-surface p-5 shadow-card">
            <div className="eyebrow">{g.goalType}</div>
            <h2 className="mt-2 font-display text-card text-navy-900">{g.title}</h2>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-200">
              <div className={g.progressPct >= 100 ? "h-full bg-success" : "h-full bg-navy-900"} style={{ width: `${Math.min(100, g.progressPct)}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-small">
              <span className="num text-ink-900">{g.progressPct.toFixed(0)}%</span>
              <span className="text-ink-500">
                <span className="num">{g.target.current.toLocaleString("en-US")}</span> of <span className="num">{g.target.target.toLocaleString("en-US")}</span> {g.target.unit} by {formatDate(g.target.by)}
              </span>
            </div>
          </article>
        ))}
      </div>
      {tracker && <AgentOutput className="mt-8" agent="Your adviser's goal review" output={tracker.output} at={tracker.at} />}
    </PageContainer>
  );
}
