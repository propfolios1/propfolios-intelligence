import type { DDFinding } from "@/lib/ai/schemas";
import type { Severity } from "@/lib/domain";
import { cn } from "@/lib/utils";
import { SeverityBadge } from "../status";

const ORDER: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const LABEL: Record<Severity, string> = { CRITICAL: "Critical", HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

/** Findings grouped by severity. Each is a ruled entry: what, evidence, action. */
export function DDTab({ findings }: { findings: DDFinding[] }) {
  const counts = ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length] as const);
  return (
    <div>
      <dl className="grid grid-cols-2 gap-x-6 md:grid-cols-4">
        {counts.map(([s, n]) => (
          <div key={s} className="border-t border-ink-200 pt-4">
            <dt className="eyebrow">{LABEL[s]}</dt>
            <dd className={cn("num mt-4 text-figure", (s === "CRITICAL" || s === "HIGH") && n > 0 ? "text-danger" : "text-navy-900")}>{n}</dd>
          </div>
        ))}
      </dl>

      {ORDER.map((sev) => {
        const group = findings.filter((f) => f.severity === sev);
        if (!group.length) return null;
        return (
          <section key={sev} className="mt-16">
            <h2 className="font-display text-card text-navy-900">
              {LABEL[sev]}
              <sup className="num ml-1.5 text-small text-ink-500">{group.length}</sup>
            </h2>
            <div className="mt-6 border-t border-ink-200">
              {group.map((f) => (
                <article key={f.id} className="grid grid-cols-1 gap-x-6 gap-y-4 border-b border-ink-200 py-8 lg:grid-cols-12">
                  <div className="lg:col-span-5">
                    <div className="flex items-center gap-3">
                      <SeverityBadge severity={f.severity} />
                      <span className="num text-axis text-ink-500">{f.id}</span>
                      <span className="eyebrow text-ink-500">{f.category}</span>
                    </div>
                    <h3 className="mt-3 text-card font-medium text-ink-900">{f.title}</h3>
                    <p className="mt-2 text-ui text-ink-700">{f.description}</p>
                  </div>
                  <dl className="grid grid-cols-1 gap-4 lg:col-span-6 lg:col-start-7 lg:grid-cols-2">
                    <div>
                      <dt className="eyebrow text-ink-500">Evidence</dt>
                      <dd className="mt-2 text-small text-ink-700">{f.evidence}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow text-ink-500">Action</dt>
                      <dd className="mt-2 text-small text-ink-900">{f.action}</dd>
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
