import { desc, eq, ne, sql } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { ForgetMemory } from "@/components/fabric/forget-memory";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { StructuredDetail } from "@/components/os/structured-detail";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { OS_AGENT_INDEX } from "@/lib/ai/os-agents/registry";
import { requireRole } from "@/lib/auth";
import { can } from "@/lib/rbac/permissions";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "AI memory" };
export const dynamic = "force-dynamic";

const TYPE: Record<string, { label: string; note: string }> = {
  house_style: { label: "House style", note: "How this firm writes: structure, tone and the clauses it insists on" },
  client_preferences: { label: "Client preferences", note: "What a client has asked for and how they decide" },
  developer_patterns: { label: "Developer patterns", note: "Delivery, complaint and compliance history by developer" },
  analyst_patterns: { label: "Analyst patterns", note: "How the team works: the actions each person takes most" },
  jurisdiction_patterns: { label: "Jurisdiction patterns", note: "Recurring findings by market and regulator" },
  deal_patterns: { label: "Deal patterns", note: "Discounts achieved, days to close and what predicts a close" },
};

export default async function AiMemory() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [learned, outputs, names] = await Promise.all([
    db.select().from(s.agentMemories).where(scope(s.agentMemories, user.tenantId, ne(s.agentMemories.memoryType, "last_output"))).orderBy(desc(s.agentMemories.updatedAt)),
    db
      .select({ agent: s.agentMemories.agentName, n: sql<number>`count(*)::int`, last: sql<string>`max(${s.agentMemories.updatedAt})` })
      .from(s.agentMemories)
      .where(scope(s.agentMemories, user.tenantId, eq(s.agentMemories.memoryType, "last_output")))
      .groupBy(s.agentMemories.agentName)
      .orderBy(desc(sql`count(*)`)),
    Promise.all([
      db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(scope(s.clients, user.tenantId)),
      db.select({ id: s.developers.id, name: s.developers.name }).from(s.developers).where(scope(s.developers, user.tenantId)),
      db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(eq(s.users.tenantId, user.tenantId)),
    ]).then((r) => new Map(r.flat().map((x) => [x.id, x.name]))),
  ]);
  const forget = can(user.accessRole, "firm:ai_control");
  const label = (a: string) => OS_AGENT_INDEX[a]?.label ?? a.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
  const about = (m: (typeof learned)[number]) => (m.scopeKey === "tenant" ? "Whole firm" : (names.get(m.entityId ?? "") ?? m.scopeKey));

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Analyst desk · Intelligence"
        title="AI memory"
        subtitle="What the agents have learned about this firm: its house style, its clients, the developers it works with and how its deals close. Memory is loaded before each run and updated after it, and never leaves this workspace."
      />
      <section className="mt-8 stat-row">
        <StatCard label="Learned memories" value={String(learned.length)} />
        <StatCard label="Agents learning" value={String(new Set(learned.map((m) => m.agentName)).size)} />
        <StatCard label="Stored outputs" value={String(outputs.reduce((a, o) => a + o.n, 0))} note="Shown inline on each page" />
        <StatCard label="Observations behind them" value={learned.reduce((a, m) => a + (m.sampleSize ?? 0), 0).toLocaleString("en-US")} />
      </section>

      <Section title="Learned" description="Each memory names the agent that holds it, what it is about, and how many observations it rests on.">
        {learned.length === 0 ? (
          <p className="rounded-md border border-hairline bg-surface px-6 py-10 text-center text-small text-ink-500">The agents have not learned anything yet. Memory forms as deals close, memos are approved and reports are written.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {learned.map((m) => (
              <article key={m.id} className="rounded-md border border-hairline bg-surface p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">{TYPE[m.memoryType]?.label ?? m.memoryType}</div>
                    <h3 className="mt-1 text-body font-medium text-ink-900">
                      {label(m.agentName)} · {about(m)}
                    </h3>
                    <p className="mt-0.5 text-axis text-ink-500">{TYPE[m.memoryType]?.note}</p>
                  </div>
                  {forget && <ForgetMemory id={m.id} />}
                </div>
                <div className="mt-4 border-t border-hairline pt-4">
                  <StructuredDetail output={m.memory} />
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 text-axis text-ink-500">
                  {m.sampleSize !== null && (
                    <span>
                      <span className="num text-ink-700">{m.sampleSize}</span> observations
                    </span>
                  )}
                  {m.confidence !== null && (
                    <span>
                      Confidence <span className="num text-ink-700">{Math.round(m.confidence * 100)}%</span>
                    </span>
                  )}
                  <span>
                    Updated <RelativeTime iso={m.updatedAt.toISOString()} />
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </Section>

      <Section title="Stored outputs" description="The latest result from each agent for each record, kept so pages show it without running the agent again.">
        <SimpleTable
          rows={outputs}
          minWidth={560}
          columns={[
            { key: "a", header: "Agent", cell: (o) => <span className="text-ink-900">{label(o.agent)}</span> },
            { key: "n", header: "Records", numeric: true, cell: (o) => o.n },
            { key: "l", header: "Latest", cell: (o) => <RelativeTime iso={new Date(o.last).toISOString()} /> },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
