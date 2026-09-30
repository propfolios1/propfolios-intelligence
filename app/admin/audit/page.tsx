import { AuditList } from "@/components/composites/audit-list";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { listAudit } from "@/lib/data/store";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default function AuditPage() {
  const events = listAudit();
  return (
    <PageContainer className="pt-10 md:pt-12">
      <PageHeader title="Audit log" subtitle={`${events.length} events. Every agent run records its cost.`} />
      <div className="mt-8">
        <AuditList events={events} showMandate dense />
      </div>
    </PageContainer>
  );
}
