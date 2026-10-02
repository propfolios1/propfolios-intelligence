import Link from "next/link";
import { notFound } from "next/navigation";
import { MemoActions } from "@/components/composites/memo-actions";
import { MemoEditor } from "@/components/composites/memo-editor";
import { MemoStatusPill, RecommendationPill } from "@/components/composites/status";
import { Crumb } from "@/components/shell/crumb";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { HttpError, requireRole } from "@/lib/auth";
import type { ResearchOutput } from "@/lib/ai/schemas";
import { getMemo } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Memo" };

export default async function MemoPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { id } = await params;
  let row;
  try {
    row = await getMemo(await getDb(), user, id);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  const { memo, mandate, clientName, propertyName } = row;
  const research = mandate.research as ResearchOutput | null;
  const text = memo.contentHtml.replace(/<[^>]+>/g, " ");
  return (
    <PageContainer className="pt-8 md:pt-10">
      <Crumb segment={id} label={mandate.reference} />
      <header className="flex flex-col gap-4 border-b border-ink-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/analyst/mandates/${mandate.id}`} className="num text-small text-ink-500 hover:text-ink-900">
              {mandate.reference}
            </Link>
            <MemoStatusPill status={memo.status} />
            <RecommendationPill value={mandate.recommendation} />
          </div>
          <h1 className="mt-3 font-display text-section text-navy-900">{memo.title}</h1>
          <p className="mt-1 text-small text-ink-500">
            {clientName} · {propertyName} · version {memo.version} · last edited by {memo.lastEditedBy ?? "Memo agent"} on {formatDate(memo.updatedAt)}
            {memo.approvedBy && ` · approved by ${memo.approvedBy}`}
          </p>
        </div>
        <MemoActions memoId={memo.id} status={memo.status} reference={mandate.reference} />
      </header>
      <div className="mt-8">
        <MemoEditor
          key={`${memo.id}-${memo.version}`}
          memoId={memo.id}
          version={memo.version}
          readOnly={memo.status === "delivered"}
          initialHtml={memo.contentHtml}
          flags={memo.keyMetrics.map((k) => ({
            claim: `${k.label}: ${k.value}`,
            issue: text.includes(k.value) ? "verified" : "missing_citation",
            severity: text.includes(k.value) ? "low" : "medium",
            suggestion: text.includes(k.value) ? "Figure appears in the memo body." : "Key metric does not appear in the memo body.",
          }))}
          citations={(research?.citations ?? []).map((c) => ({ id: c.id, title: c.title, source: c.source, date: c.accessed }))}
          dataSources={[{ title: "Key metrics", items: memo.keyMetrics }]}
        />
      </div>
    </PageContainer>
  );
}
