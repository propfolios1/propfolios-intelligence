import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { MemosTable } from "@/components/composites/tables/memos-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listMemos } from "@/lib/queries";

export const metadata = { title: "Memos" };
export const dynamic = "force-dynamic";

export default async function MemosPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const memos = await listMemos(await getDb(), user);
  const count = (s: string) => memos.filter((m) => m.status === s).length;
  return (
    <PageContainer>
      <PageHeader eyebrow="Investment committee" title="Memos" subtitle="Allocation and Exit Memos drafted by the memo agent, edited by analysts and approved by the committee before delivery." />
      <section className="mt-8 stat-row">
        <StatCard label="In review" value={String(count("in_review"))} />
        <StatCard label="Draft" value={String(count("draft"))} />
        <StatCard label="Approved" value={String(count("approved"))} />
        <StatCard label="Delivered" value={String(count("delivered"))} />
      </section>
      <div className="mt-8">
        <MemosTable rows={memos.map((m) => ({ id: m.id, title: m.title, status: m.status, version: m.version, reference: m.reference, clientName: m.clientName, recommendation: m.recommendation, approvedBy: m.approvedBy, updatedAt: m.updatedAt.toISOString() }))} />
      </div>
    </PageContainer>
  );
}
