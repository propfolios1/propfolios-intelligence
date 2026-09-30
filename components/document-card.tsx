import { Download, FileText } from "lucide-react";
import type { DocumentItem } from "@/lib/data/types";
import { Pill } from "./ui/pill";
import { cn, formatDate } from "@/lib/utils";

/** Typographic PDF thumbnail — a miniature first page, no imagery. */
function PdfPreview({ doc }: { doc: DocumentItem }) {
  const seed = doc.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const lines = Array.from({ length: 11 }, (_, i) => 55 + ((seed * (i + 3)) % 40));
  return (
    <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-t-card border-b border-ink-200 bg-ink-50">
      <div className="h-[150px] w-[116px] translate-y-3 rounded-[3px] bg-surface px-3 pt-3 shadow-card ring-1 ring-ink-200 transition-transform duration-250 ease-brand group-hover:-translate-y-0">
        <div className="h-[3px] w-6 bg-gold-500" />
        <div className="mt-2 h-[5px] w-4/5 rounded-full bg-navy-900" />
        <div className="mt-1 h-[5px] w-3/5 rounded-full bg-navy-900" />
        <div className="mt-3 space-y-[5px]">
          {lines.map((w, i) => (
            <div key={i} className={cn("h-[3px] rounded-full bg-ink-200", i === 5 && "mt-2.5")} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
      <span className="num absolute top-3 right-3 rounded-[3px] bg-surface px-1.5 py-0.5 text-[10px] text-ink-500 ring-1 ring-ink-200">PDF</span>
    </div>
  );
}

export function DocumentCard({ doc, subtitle }: { doc: DocumentItem; subtitle?: string }) {
  return (
    <article className="group rounded-card border border-ink-200 bg-surface transition-[transform,border-color] duration-250 ease-brand hover:-translate-y-px hover:border-ink-300">
      <PdfPreview doc={doc} />
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <Pill tone="outline">{doc.type}</Pill>
          <button className="rounded-control p-1 text-ink-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-ink-100 hover:text-ink-900" aria-label={`Download ${doc.title}`}>
            <Download className="size-4" />
          </button>
        </div>
        <h3 className="mt-3 line-clamp-2 text-sm font-medium text-ink-900">{doc.title}</h3>
        {subtitle && <p className="mt-0.5 truncate text-xs text-ink-500">{subtitle}</p>}
        <div className="num mt-3 flex items-center gap-3 text-[11px] text-ink-400">
          <span className="flex items-center gap-1">
            <FileText className="size-3" /> {doc.pages} pp
          </span>
          <span>{(doc.sizeKb / 1024).toFixed(1)} MB</span>
          <span className="ml-auto">{formatDate(doc.createdAt)}</span>
        </div>
      </div>
    </article>
  );
}
