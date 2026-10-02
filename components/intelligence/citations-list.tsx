export interface CitationItem {
  id: number;
  title: string;
  source: string;
  url: string;
  accessed: string;
}

/** Numbered sources matching the [n] markers in the text. */
export function CitationsList({ citations, title = "Sources" }: { citations: CitationItem[]; title?: string }) {
  if (!citations.length) return null;
  return (
    <div>
      <div className="eyebrow">{title}</div>
      <ol className="mt-4 border-t border-ink-200">
        {citations.map((c) => (
          <li key={c.id} className="grid grid-cols-[24px_1fr] gap-3 border-b border-ink-200 py-3.5">
            <span className="num text-small text-ink-500">{c.id}</span>
            <div>
              <a href={c.url} target="_blank" rel="noreferrer" className="text-small text-ink-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
                {c.title}
              </a>
              <div className="text-small text-ink-500">
                {c.source}, accessed <span className="num">{c.accessed}</span>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
