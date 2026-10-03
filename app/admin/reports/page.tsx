import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { ServicingButton } from "@/components/client/kyc-actions";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { jobsDue } from "@/lib/os/schedule";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Client reports" };
export const dynamic = "force-dynamic";

export default async function AdminReports() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [reports, statements, clients] = await Promise.all([
    db.select({ r: s.clientReports, client: s.clients.name }).from(s.clientReports).innerJoin(s.clients, eq(s.clients.id, s.clientReports.clientId)).where(scope(s.clientReports, user.tenantId)).orderBy(desc(s.clientReports.generatedAt)),
    db.select({ id: s.statements.id }).from(s.statements).where(scope(s.statements, user.tenantId)),
    db.select().from(s.clients).where(scope(s.clients, user.tenantId)),
  ]);
  const next = (() => {
    for (let i = 1; i < 120; i++) {
      const d = new Date(Date.now() + i * 86_400_000);
      if (jobsDue(d).includes("reports")) return d;
    }
    return null;
  })();
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Client servicing" title="Reports and statements" subtitle="Monthly statements on the 1st, quarterly reports on the first day of each quarter and annual tax documents on 1 April, written by the report writer and statement agents. Generate any of them on demand." />
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Reports" value={String(reports.length)} />
        <StatCard label="Statements" value={String(statements.length)} />
        <StatCard label="Viewed by clients" value={String(reports.filter((r) => r.r.viewedAt).length)} />
        <StatCard label="Next quarterly run" value={next ? next.toISOString().slice(0, 10) : "None"} />
      </section>
      <Section title="On demand" description="Each button runs the agent for that client now.">
        <SimpleTable
          rows={clients}
          minWidth={820}
          columns={[
            { key: "n", header: "Client", cell: (c) => <span className="text-ink-900">{c.name}</span> },
            { key: "r", header: "", cell: (c) => <div className="flex flex-wrap gap-2"><ServicingButton clientId={c.id} action="report" body={{ type: "quarterly" }} label="Quarterly report" ok="Report written" /><ServicingButton clientId={c.id} action="statement" label="Last month's statement" ok="Statement prepared" /><ServicingButton clientId={c.id} action="tax-documents" body={{ year: new Date().getUTCFullYear() - 1 }} label="Tax documents" ok="Tax documents prepared" /></div> },
          ]}
        />
      </Section>
      <Section title="Generated reports">
        <SimpleTable
          rows={reports}
          minWidth={820}
          columns={[
            { key: "t", header: "Report", cell: (r) => <span className="text-ink-900">{r.r.title}</span> },
            { key: "c", header: "Client", cell: (r) => r.client },
            { key: "p", header: "Period", cell: (r) => <span className="num">{r.r.period}</span> },
            { key: "g", header: "Generated", cell: (r) => <RelativeTime iso={r.r.generatedAt.toISOString()} /> },
            { key: "v", header: "Viewed", cell: (r) => (r.r.viewedAt ? <RelativeTime iso={r.r.viewedAt.toISOString()} /> : "Not yet") },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
