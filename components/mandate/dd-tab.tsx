import { SeverityPill } from "@/components/status";
import type { DDFinding, Severity } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const ORDER: Severity[] = ["critical", "high", "medium", "low"];
const BAR: Record<Severity, string> = { critical: "bg-negative", high: "bg-warning", medium: "bg-navy-500", low: "bg-ink-300" };

export function DDTab({ findings }: { findings: DDFinding[] }) {
  const counts = ORDER.map((s) => [s, findings.filter((f) => f.severity === s).length] as const);
  const total = findings.length || 1;
  return (
    <div className="space-y-10">
      <div className="rounded-card border border-ink-200 bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <div className="eyebrow">Findings</div>
            <div className="num mt-2 text-[32px] leading-none text-navy-900">{findings.length}</div>
          </div>
          <div className="flex flex-wrap gap-6">
            {counts.map(([s, n]) => (
              <div key={s} className="flex items-center gap-2 text-sm">
                <span className={cn("size-2 rounded-full", BAR[s])} />
                <span className="text-ink-600 capitalize">{s}</span>
                <span className="num text-ink-900">{n}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full">
          {counts.map(([s, n]) => (n ? <div key={s} className={BAR[s]} style={{ width: `${(n / total) * 100}%` }} /> : null))}
        </div>
      </div>

      {ORDER.map((sev) => {
        const group = findings.filter((f) => f.severity === sev);
        if (!group.length) return null;
        return (
          <section key={sev}>
            <h3 className="eyebrow mb-4 capitalize">
              {sev} · <span className="num">{group.length}</span>
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {group.map((f) => (
                <article key={f.id} className="rounded-card border border-ink-200 bg-surface p-6">
                  <div className="flex items-center gap-2">
                    <SeverityPill severity={f.severity} />
                    <span className="text-xs text-ink-500">{f.category}</span>
                  </div>
                  <h4 className="mt-3 text-[15px] font-medium text-ink-900">{f.title}</h4>
                  <p className="mt-1.5 text-secondary text-ink-700">{f.description}</p>
                  <dl className="mt-4 space-y-3 border-t border-ink-200 pt-4 text-sm">
                    <div>
                      <dt className="eyebrow">Evidence</dt>
                      <dd className="mt-1 text-ink-700">{f.evidence}</dd>
                    </div>
                    <div>
                      <dt className="eyebrow">Recommended action</dt>
                      <dd className="mt-1 text-ink-900">{f.action}</dd>
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
