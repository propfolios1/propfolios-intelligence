import "server-only";
import type { DB } from "@/db";
import type { CurrentUser } from "@/lib/auth";
import { getMemo } from "@/lib/queries";
import { getTenantById } from "@/lib/tenant";
import { renderMemoPdf } from "./memo-pdf";

const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** Renders a memo as an A4 PDF in the tenant's house style. */
export async function memoPdf(db: DB, user: CurrentUser, memoId: string) {
  const { memo, mandate, clientName } = await getMemo(db, user, memoId);
  const cfg = (await getTenantById(user.tenantId))!.configJson;
  const pdf = await renderMemoPdf({
    brandName: cfg.brand_name,
    primaryColor: cfg.primary_color,
    accentColor: cfg.accent_color,
    signoff: cfg.memo_style.signoff,
    disclaimer: cfg.memo_style.disclaimer,
    title: memo.title,
    reference: mandate.reference,
    clientName,
    preparedBy: memo.lastEditedBy && memo.lastEditedBy !== "Memo agent" ? memo.lastEditedBy : `${cfg.brand_name} advisory team`,
    date: fmt(memo.updatedAt),
    status: memo.status,
    approvedBy: memo.approvedBy,
    approvedAt: memo.approvedAt ? fmt(memo.approvedAt) : null,
    version: memo.version,
    keyMetrics: memo.keyMetrics,
    html: memo.contentHtml,
  });
  const filename = `${mandate.reference}-${memo.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "")}.pdf`;
  return { pdf, filename, memo, mandate };
}
