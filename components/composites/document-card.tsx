import type { DocumentItem } from "@/lib/data/types";
import { cn, formatDate } from "@/lib/utils";

function seedOf(s: string) {
  return s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

/**
 * First page of the PDF, set in miniature: a gold masthead rule, a serif title
 * block, ruled text. Each document draws a different page from its id.
 */
function PagePreview({ doc }: { doc: DocumentItem }) {
  const seed = seedOf(doc.id);
  const lines = Array.from({ length: 12 }, (_, i) => 52 + ((seed * (i + 5)) % 44));
  const hasTable = doc.type === "Statement" || doc.type === "Valuation";
  return (
    <div className="flex h-52 items-end justify-center overflow-hidden border-b border-ink-200 bg-ink-100 px-6">
      <div className="h-[184px] w-[136px] translate-y-3 border border-ink-200 bg-surface px-3.5 pt-4 transition-transform duration-200 ease-out group-hover:translate-y-1.5">
        <div className="h-0.5 w-5 bg-gold-500" />
        <div className="mt-2.5 font-display text-[11px] leading-[1.15] text-navy-900 line-clamp-3">{doc.title}</div>
        <div className="mt-3 flex flex-col gap-[5px]">
          {lines.slice(0, hasTable ? 4 : 12).map((w, i) => (
            <div key={i} className={cn("h-[2px] bg-ink-200", i === 4 && "mt-1.5")} style={{ width: `${w}%` }} />
          ))}
        </div>
        {hasTable && (
          <div className="mt-3 border-t border-ink-500">
            {[0, 1, 2, 3, 4].map((r) => (
              <div key={r} className="flex justify-between border-b border-ink-200 py-[3px]">
                <span className="h-[2px] w-8 bg-ink-200" />
                <span className="h-[2px] w-5 bg-ink-500/50" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function DocumentCard({ doc, subtitle }: { doc: DocumentItem; subtitle?: string }) {
  return (
    <a
      href="#"
      className="group block border border-ink-200 transition-[border-color,transform] duration-120 ease-[ease] hover:-translate-y-px hover:border-ink-500"
      aria-label={`${doc.title}, ${doc.type}, ${doc.pages} pages`}
    >
      <PagePreview doc={doc} />
      <div className="px-4 pt-4 pb-5">
        <div className="eyebrow text-ink-500">{doc.type}</div>
        <h3 className="mt-2 line-clamp-2 min-h-[2.8em] text-ui leading-[1.4] text-ink-900">{doc.title}</h3>
        {subtitle && <p className="mt-1 truncate text-small text-ink-500">{subtitle}</p>}
        <div className="num mt-4 flex items-baseline justify-between border-t border-ink-200 pt-3 text-small text-ink-500">
          <span>
            {doc.pages} pp · {(doc.sizeKb / 1024).toFixed(1)} MB
          </span>
          <span>{formatDate(doc.createdAt)}</span>
        </div>
      </div>
    </a>
  );
}
