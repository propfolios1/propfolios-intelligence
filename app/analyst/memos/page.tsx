import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { MemosTable } from "@/components/tables/memos-table";
import { listMemos } from "@/lib/data/store";

export const metadata = { title: "Memos" };

export default function MemosPage() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Deliverables" title="Memos" subtitle="Investment memos drafted by the memo-writer agent and edited by the team." />
      <div className="mt-10">
        <MemosTable rows={listMemos()} />
      </div>
    </PageContainer>
  );
}
