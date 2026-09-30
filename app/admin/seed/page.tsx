import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { SeedButton } from "@/components/seed-button";
import { clients, developers, listAudit, listMandates, listMemos, properties, runtimeStats } from "@/lib/data/store";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Data & Seed" };
export const dynamic = "force-dynamic";

export default function SeedPage() {
  const stats = runtimeStats();
  const counts = [
    ["Clients", clients.length],
    ["Mandates", listMandates().length],
    ["Properties", properties.length],
    ["Developers", developers.length],
    ["Memos", listMemos().length],
    ["Audit events", listAudit().length],
    ["Agent runs (live)", stats.agentRuns],
    ["Analyses (live)", stats.analyses],
  ] as const;
  return (
    <PageContainer dense>
      <PageHeader eyebrow="Admin" title="Data & seed" subtitle={`Runtime state since ${formatDate(new Date(stats.seededAt), "datetime")}.`} actions={<SeedButton />} />
      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-ink-200 bg-ink-200 md:grid-cols-4">
        {counts.map(([k, v]) => (
          <div key={k} className="bg-surface px-5 py-4">
            <dt className="eyebrow">{k}</dt>
            <dd className="num mt-2 text-xl text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
    </PageContainer>
  );
}
