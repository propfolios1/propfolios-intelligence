import { PageHeader } from "@/components/composites/page-header";
import { MemosTable } from "@/components/composites/tables/memos-table";
import { PageContainer } from "@/components/shell/page-container";
import { listMemos } from "@/lib/data/store";

export const metadata = { title: "Memos" };

export default function MemosPage() {
  const memos = listMemos();
  const review = memos.filter((m) => m.status === "In review").length;
  return (
    <PageContainer>
      <PageHeader eyebrow="Deliverables" title="Memos" subtitle={`${memos.length} memos. ${review} in review.`} />
      <div className="mt-10">
        <MemosTable rows={memos} />
      </div>
    </PageContainer>
  );
}
