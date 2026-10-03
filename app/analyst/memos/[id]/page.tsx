import Link from "next/link";
import { notFound } from "next/navigation";
import { MemoActions } from "@/components/composites/memo-actions";
import { MemoEditor } from "@/components/composites/memo-editor";
import { MemoStatusPill } from "@/components/composites/status";
import { Crumb } from "@/components/shell/crumb";
import { getDb } from "@/db";
import { HttpError, requireRole } from "@/lib/auth";
import { learnHouseStyle, styleMatch } from "@/lib/ai/house-style";
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
  const learned = await learnHouseStyle(await getDb(), user.tenantId, mandate.id);
  return (
    <>
      <Crumb segment={id} label={mandate.reference} />
      <MemoEditor
        key={`${memo.id}-${memo.version}`}
        memoId={memo.id}
        version={memo.version}
        readOnly={memo.status === "delivered"}
        initialHtml={memo.contentHtml}
        title={memo.title}
        styleMatch={styleMatch(memo.contentHtml, learned)}
        verifiedClaims={(memo.factCheck as { verifiedClaims?: number } | null)?.verifiedClaims}
        meta={
          <>
            <Link href={`/analyst/mandates/${mandate.id}`} className="num shrink-0 text-ink-500 hover:text-ink-900">
              {mandate.reference}
            </Link>
            <MemoStatusPill status={memo.status} />
            <span className="hidden truncate md:inline">
              {clientName} · {propertyName} · <span className="num">v{memo.version}</span> · {memo.lastEditedBy ?? "Memo agent"}, <span className="num">{formatDate(memo.updatedAt)}</span>
            </span>
          </>
        }
        actions={<MemoActions memoId={memo.id} status={memo.status} reference={mandate.reference} />}
        flags={memo.keyMetrics.map((k) => ({
          claim: `${k.label}: ${k.value}`,
          issue: text.includes(k.value) ? "verified" : "missing_citation",
          severity: text.includes(k.value) ? "low" : "medium",
          suggestion: text.includes(k.value) ? "The figure appears in the memo body." : "The key metric does not appear in the memo body. Add it, or confirm the figure.",
        }))}
        citations={(research?.citations ?? []).map((c) => ({ id: c.id, title: c.title, source: c.source, date: c.accessed }))}
        dataSources={[{ title: "Key metrics", items: memo.keyMetrics }, { title: "Mandate", items: [{ label: "Client", value: clientName }, { label: "Property", value: propertyName }, { label: "Recommendation", value: mandate.recommendation ?? "Pending" }] }]}
      />
    </>
  );
}
