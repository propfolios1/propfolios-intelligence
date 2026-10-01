import { FileText } from "lucide-react";
import { DOC_TYPE_LABEL } from "@/lib/domain";
import { cn, formatDate } from "@/lib/utils";

export interface DocumentCardData {
  id: string;
  title: string;
  type: string;
  pages: number;
  sizeBytes: number;
  blobUrl: string | null;
  createdAt: Date | string;
}

function size(bytes: number) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** A document tile. Opens the stored file, or the memo PDF when a memo has no stored file. */
export function DocumentCard({ doc, href, subtitle, className }: { doc: DocumentCardData; href?: string | null; subtitle?: string; className?: string }) {
  const link = href ?? doc.blobUrl;
  const Body = (
    <>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-navy-50 text-navy-900">
          <FileText className="size-4 stroke-[1.5]" />
        </span>
        <div className="min-w-0">
          <div className="eyebrow">{DOC_TYPE_LABEL[doc.type] ?? doc.type}</div>
          <h3 className="mt-1 line-clamp-2 text-ui font-medium text-ink-900">{doc.title}</h3>
          {subtitle && <p className="mt-0.5 truncate text-small text-ink-500">{subtitle}</p>}
        </div>
      </div>
      <div className="num mt-4 flex items-baseline justify-between border-t border-ink-200 pt-3 text-axis text-ink-500">
        <span>
          {doc.pages} pp · {size(doc.sizeBytes)}
        </span>
        <span>{formatDate(doc.createdAt instanceof Date ? doc.createdAt : new Date(doc.createdAt))}</span>
      </div>
      {!link && <p className="mt-2 text-[0.75rem] text-ink-500">Record only. File storage is not configured.</p>}
    </>
  );
  const cls = cn("block rounded-md border border-ink-200 bg-surface p-4 shadow-card", link && "transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-ink-400", className);
  return link ? (
    <a id={doc.id} href={link} target="_blank" rel="noreferrer" className={cls} aria-label={`${doc.title}, opens in a new tab`}>
      {Body}
    </a>
  ) : (
    <div id={doc.id} className={cls}>
      {Body}
    </div>
  );
}
