import { getDb } from "@/db";
import { audit, handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { renderMemoPdf } from "@/lib/pdf/memo-pdf";
import { getMemo } from "@/lib/queries";

export const runtime = "nodejs";
export const maxDuration = 60;

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Renders the memo as an A4 PDF. */
export const GET = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await params;
  const db = await getDb();
  const { memo, mandate, clientName } = await getMemo(db, user, id);
  const pdf = await renderMemoPdf({
    title: memo.title,
    reference: mandate.reference,
    clientName,
    preparedBy: memo.lastEditedBy && memo.lastEditedBy !== "Memo agent" ? memo.lastEditedBy : "PropFolios advisory team",
    date: fmt(memo.updatedAt),
    status: memo.status,
    approvedBy: memo.approvedBy,
    approvedAt: memo.approvedAt ? fmt(memo.approvedAt) : null,
    version: memo.version,
    keyMetrics: memo.keyMetrics,
    html: memo.contentHtml,
  });
  await audit(user, "exported memo PDF", { entityType: "memo", entityId: id, mandateId: mandate.id });
  const name = `${mandate.reference}-${memo.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}.pdf`;
  return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${name}"`, "cache-control": "private, no-store" } });
});
