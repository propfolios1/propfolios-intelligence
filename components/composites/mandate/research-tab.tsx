import type { ResearchDossier } from "@/lib/data/types";
import { CitedText } from "../citation";

/** The dossier on a 680px measure. Sources run alongside, numbered to match the superscripts. */
export function ResearchTab({ research }: { research: ResearchDossier }) {
  const sources = research.citations.map((c) => ({ id: c.id, title: c.title, source: c.source, date: c.date }));
  return (
    <div className="grid grid-cols-1 gap-16 xl:grid-cols-12 xl:gap-6">
      <article className="prose-pf xl:col-span-7">
        <p className="font-display text-card leading-[1.4] text-navy md:text-[1.625rem]">
          <CitedText text={research.summary} sources={sources} />
        </p>

        {research.dataGaps.length > 0 && (
          <aside className="my-12 bg-paper-2 px-6 py-5" role="note">
            <div className="eyebrow text-red">Unverified</div>
            <ul className="mt-3 mb-0 text-small text-ink-2">
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

      <aside className="xl:sticky xl:top-32 xl:col-span-4 xl:col-start-9 xl:self-start">
        <div className="eyebrow">Sources</div>
        <ol className="mt-4 border-t-2 border-ink">
          {research.citations.map((c) => (
            <li key={c.id} className="grid grid-cols-[24px_1fr] gap-3 border-b border-rule py-3.5">
              <span className="num text-small text-ink-3">{c.id}</span>
              <div>
                <div className="text-small text-ink">{c.title}</div>
                <div className="text-small text-ink-3">
                  {c.source}, <span className="num">{c.date}</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
