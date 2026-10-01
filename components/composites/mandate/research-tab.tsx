import type { ResearchOutput as ResearchDossier } from "@/lib/ai/schemas";
import { SeverityBadge } from "../status";
import { CitedText } from "../citation";

/** The dossier on a 680px measure. Sources run alongside, numbered to match the superscripts. */
export function ResearchTab({ research }: { research: ResearchDossier }) {
  const sources = research.citations.map((c) => ({ id: c.id, title: c.title, source: c.source, date: c.accessed, href: c.url }));
  return (
    <div className="grid grid-cols-1 gap-16 xl:grid-cols-12 xl:gap-6">
      <article className="prose-pf xl:col-span-7">
        <p className="font-display text-card leading-[1.4] text-navy-900 md:text-[1.625rem]">
          <CitedText text={research.summary} sources={sources} />
        </p>

        {research.dataGaps.length > 0 && (
          <aside className="my-10 rounded-md border border-warning/30 bg-warning-soft px-6 py-5" role="note">
            <div className="eyebrow text-warning">Data gaps</div>
            <ul className="mt-3 mb-0 text-small text-ink-700">
              {research.dataGaps.map((g) => (
                <li key={g}>{g.replace(/^DATA_GAP:\s*/, "")}</li>
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

      <aside className="xl:sticky xl:top-32 xl:col-span-4 xl:col-start-9 xl:self-start">
        <div className="eyebrow">Risks identified</div>
        <ul className="mt-4 mb-10 border-t border-ink-200">
          {research.risks.map((r) => (
            <li key={r.title} className="border-b border-ink-200 py-3.5">
              <div className="flex items-center gap-2">
                <SeverityBadge severity={r.severity} />
                <span className="text-small font-medium text-ink-900">{r.title}</span>
              </div>
              <p className="mt-1.5 text-small text-ink-700">{r.detail}</p>
            </li>
          ))}
        </ul>
        <div className="eyebrow">Sources</div>
        <ol className="mt-4 border-t border-ink-200">
          {research.citations.map((c) => (
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
      </aside>
    </div>
  );
}
