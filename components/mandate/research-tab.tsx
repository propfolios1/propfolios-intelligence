import { AlertTriangle } from "lucide-react";
import { CitedText } from "@/components/citation";
import type { ResearchDossier } from "@/lib/data/types";

export function ResearchTab({ research }: { research: ResearchDossier }) {
  const sources = research.citations.map((c) => ({ id: c.id, title: c.title, source: c.source, date: c.date }));
  return (
    <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,720px)_minmax(0,1fr)]">
      <article className="prose-pf">
        <div className="eyebrow mb-3">Research dossier</div>
        <p className="text-lead text-ink-700">
          <CitedText text={research.summary} sources={sources} />
        </p>

        {research.dataGaps.length > 0 && (
          <aside className="my-8 rounded-card bg-warning-soft px-5 py-4 not-italic" role="note">
            <div className="flex items-center gap-2 text-sm font-medium text-warning">
              <AlertTriangle className="size-4" /> Data gaps
            </div>
            <ul className="mt-2 mb-0 space-y-1 text-secondary text-ink-700">
              {research.dataGaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </aside>
        )}

        {research.sections.map((s) => (
          <section key={s.heading}>
            <h2>{s.heading}</h2>
            {s.body.split(/\n\s*\n/).map((para, i) => (
              <p key={i}>
                <CitedText text={para} sources={sources} />
              </p>
            ))}
          </section>
        ))}
      </article>

      <aside className="xl:sticky xl:top-32 xl:self-start">
        <div className="eyebrow mb-4">Sources</div>
        <ol className="space-y-4">
          {research.citations.map((c) => (
            <li key={c.id} className="flex gap-3 text-sm">
              <span className="num flex size-5 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[10px] text-navy-800">{c.id}</span>
              <div>
                <div className="text-ink-900">{c.title}</div>
                <div className="text-xs text-ink-500">
                  {c.source} · <span className="num">{c.date}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
