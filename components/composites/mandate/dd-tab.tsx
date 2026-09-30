import type { DDFinding, Severity } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { SeverityPill } from "../status";

const ORDER: Severity[] = ["critical", "high", "medium", "low"];
const LABEL: Record<Severity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Verified or low" };

/** Findings grouped by severity. Each is a ruled entry: what, evidence, action. */
export function DDTab({ findings }: { findings: DDFinding[] }) {
  const counts = ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length] as const);
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 md:grid-cols-4">
        {counts.map(([s, n]) => (
          <div key={s} className="border-t border-rule pt-4">
            <dt className="eyebrow">{LABEL[s]}</dt>
            <dd className={cn("num mt-4 text-figure", s === "critical" && n > 0 ? "text-red" : "text-navy")}>{n}</dd>
          </div>
        ))}
      </dl>

      {ORDER.map((sev) => {
        const group = findings.filter((f) => f.severity === sev);
        if (!group.length) return null;
        return (
          <section key={sev} className="mt-16">
            <h2 className="font-display text-section text-navy">
              {LABEL[sev]}
              <sup className="num ml-1.5 text-small text-ink-3">{group.length}</sup>
            </h2>
            <div className="mt-6 border-t-2 border-ink">
              {group.map((f) => (
                <article key={f.id} className="grid grid-cols-1 gap-x-6 gap-y-4 border-b border-rule py-8 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <div className="flex items-center gap-3">
                      <SeverityPill severity={f.severity} />
                      <span className="eyebrow text-ink-3">{f.category}</span>
                    </div>
                    <h3 className="mt-3 text-card font-medium text-ink">{f.title}</h3>
                    <p className="mt-2 text-ui text-ink-2">{f.description}</p>
                  </div>
                  <dl className="grid grid-cols-1 gap-4 lg:col-span-6 lg:col-start-7 lg:grid-cols-2">
                    <div>
                      <dt className="eyebrow text-ink-3">Evidence</dt>
                      <dd className="mt-2 text-small text-ink-2">{f.evidence}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow text-ink-3">Action</dt>
                      <dd className="mt-2 text-small text-ink">{f.action}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
