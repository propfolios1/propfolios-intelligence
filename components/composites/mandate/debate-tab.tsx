import type { DebateCase, JudgeDecision } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { RecommendationPill } from "../status";

function Side({ side, c }: { side: "bull" | "bear"; c: DebateCase }) {
  const bull = side === "bull";
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-ink pb-3">
        <h2 className={cn("eyebrow", bull ? "text-green" : "text-red")}>{bull ? "↑ Bull case" : "↓ Bear case"}</h2>
        <span className="num text-small text-ink-3">{Math.round(c.confidence * 100)}% confidence</span>
      </div>
      <p className="mt-8 font-display text-card leading-[1.35] text-navy md:text-[1.75rem]">{c.thesis}</p>
      <ol className="mt-10">
        {c.points.map((p, i) => (
          <li key={p.title} className="grid grid-cols-[40px_1fr] border-t border-rule py-5">
            <span className="num text-small text-ink-3">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <div className="text-ui font-medium text-ink">{p.title}</div>
              <p className="mt-1 text-ui text-ink-2">{p.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Two advocates, one judge. The sides are marked in green and red type, never colored borders;
 * the decision below is set like a verdict.
 */
export function DebateTab({ bull, bear, judge }: { bull: DebateCase; bear: DebateCase; judge: JudgeDecision }) {
  return (
    <div>
      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:gap-12">
        <Side side="bull" c={bull} />
        <Side side="bear" c={bear} />
      </div>
      <section className="mt-24 border-t-2 border-ink pt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="eyebrow">Decision</h2>
          <span className="flex items-center gap-3">
            <span className="num text-small text-ink-3">{Math.round(judge.confidence * 100)}% confidence</span>
            <RecommendationPill value={judge.recommendation} />
          </span>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-12 xl:grid-cols-12 xl:gap-6">
          <div className="xl:col-span-7">
            <p className="font-display text-title text-navy">{judge.recommendation}.</p>
            <p className="mt-6 max-w-[62ch] text-body text-ink-2">{judge.rationale}</p>
          </div>
          {judge.conditions.length > 0 && (
            <div className="xl:col-span-4 xl:col-start-9">
              <div className="eyebrow">Conditions</div>
              <ol className="mt-4">
                {judge.conditions.map((c, i) => (
                  <li key={c} className="grid grid-cols-[32px_1fr] border-t border-rule py-4 text-ui text-ink">
                    <span className="num text-small text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                    {c}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
