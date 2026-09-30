import { PageHeader } from "@/components/composites/page-header";
import { SeedButton } from "@/components/composites/seed-button";
import { PageContainer } from "@/components/shell/page-container";
import { clients, developers, listAudit, listMandates, listMemos, properties, runtimeStats } from "@/lib/data/store";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Data" };
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
    ["Agent runs, live", stats.agentRuns],
    ["Analyses, live", stats.analyses],
  ] as const;
  return (
    <PageContainer className="pt-10 md:pt-12">
      <PageHeader title="Data" subtitle={`Runtime state since ${formatDate(new Date(stats.seededAt), "datetime")}.`} actions={<SeedButton />} />
      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-4">
        {counts.map(([k, v]) => (
          <div key={k} className="border-t border-rule pt-3">
            <dt className="eyebrow">{k}</dt>
            <dd className="num mt-3 text-card text-ink">{v}</dd>
          </div>
        ))}
      </dl>
    </PageContainer>
  );
}
