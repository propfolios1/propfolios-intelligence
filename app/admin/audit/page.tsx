import { AuditList } from "@/components/audit-list";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { listAudit } from "@/lib/data/store";

export const metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

export default function AuditPage() {
  return (
    <PageContainer dense>
      <PageHeader eyebrow="Admin" title="Audit log" />
      <div className="mt-8">
        <AuditList events={listAudit()} showMandate dense />
      </div>
    </PageContainer>
  );
}
