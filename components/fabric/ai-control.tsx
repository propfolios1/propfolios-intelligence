"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { AgentOutput } from "@/components/os/agent-output";
import { StructuredDetail } from "@/components/os/structured-detail";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export interface ControlRow {
  number: number;
  name: string;
  label: string;
  module: string;
  model: string;
  essential: boolean;
  runs: number;
  avgUsd: number | null;
  estimateUsd: number | null;
}

type Out = { headline: string; points: { label: string; detail: string }[]; confidence: number } & Record<string, unknown>;
const usd = (v: number) => `$${v < 0.01 ? v.toFixed(4) : v.toFixed(3)}`;

/** Switch agents on or off, cap the monthly spend and test-run any agent on its sample input. */
export function AiControlPanel({ rows, disabled: initialDisabled, budget: initialBudget, ceiling }: { rows: ControlRow[]; disabled: string[]; budget: number | null; ceiling: number }) {
  const router = useRouter();
  const [disabled, setDisabled] = React.useState(new Set(initialDisabled));
  const [budget, setBudget] = React.useState(initialBudget === null ? "" : String(initialBudget));
  const [busy, setBusy] = React.useState(false);
  const [testing, setTesting] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ agent: string; output: Out; model: string; costUsd: number } | null>(null);
  const dirty = [...disabled].sort().join() !== [...initialDisabled].sort().join() || budget !== (initialBudget === null ? "" : String(initialBudget));
  const modules = [...new Set(rows.map((r) => r.module))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-md border border-hairline bg-surface p-5 shadow-card sm:flex-row sm:items-end sm:justify-between">
        <Field label="Monthly AI budget (USD)" hint="Runs continue past the budget; administrators are notified at 80% and 100%." className="sm:w-80">
          <Input type="number" min={0} step={10} placeholder="No limit" value={budget} onChange={(e) => setBudget(e.target.value)} className="num" />
        </Field>
        <div className="flex items-center gap-3">
          <span className="text-small text-ink-500">
            <span className="num text-ink-900">{rows.filter((r) => !disabled.has(r.name)).length}</span> of <span className="num">{rows.length}</span> agents active
          </span>
          <Button
            disabled={!dirty || busy}
            onClick={async () => {
              setBusy(true);
              const r = await post("/api/admin/ai-control", { disabledAgents: [...disabled], monthlyBudgetUsd: budget === "" ? null : Number(budget) }, { ok: "AI control saved", fail: "AI control not saved" });
              setBusy(false);
              if (r) router.refresh();
            }}
          >
            {busy ? "Saving" : "Save changes"}
          </Button>
        </div>
      </div>

      {result && (
        <AgentOutput agent={result.agent} output={result.output} model={result.model} costUsd={result.costUsd} at={new Date().toISOString()}>
          <StructuredDetail output={result.output} />
        </AgentOutput>
      )}

      {modules.map((m) => (
        <section key={m}>
          <h3 className="eyebrow mb-3">{m}</h3>
          <div className="overflow-x-auto rounded-md border border-hairline bg-surface shadow-card">
            <table className="w-full min-w-[860px] text-small">
              <thead className="border-b border-hairline bg-navy-50 text-left">
                <tr>
                  {["No.", "Agent", "Model", "Runs", "Avg cost / run", "Status", ""].map((h, i) => (
                    <th key={i} className={cn("px-4 py-2.5 text-axis font-medium tracking-[0.06em] text-ink-500 uppercase", (i === 0 || i === 3 || i === 4) && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows
                  .filter((r) => r.module === m)
                  .map((r) => {
                    const on = !disabled.has(r.name);
                    const cost = r.avgUsd ?? r.estimateUsd;
                    return (
                      <tr key={r.name} className="border-t border-hairline first:border-t-0">
                        <td className="num px-4 py-3 text-right text-ink-500">{String(r.number).padStart(2, "0")}</td>
                        <td className="px-4 py-3 text-ink-900">{r.label}</td>
                        <td className="num px-4 py-3 text-axis text-ink-500">{r.model}</td>
                        <td className="num px-4 py-3 text-right text-ink-900">{r.runs}</td>
                        <td className="num px-4 py-3 text-right whitespace-nowrap">
                          {cost === null ? (
                            <span className="text-ink-400">Not run live</span>
                          ) : (
                            <span className={cost > ceiling ? "text-danger" : "text-ink-900"}>
                              {usd(cost)}
                              {r.avgUsd === null && <span className="ml-1 text-label text-ink-500">est.</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {r.essential ? (
                            <span className="text-axis text-ink-500">Always on</span>
                          ) : (
                            <label className="inline-flex cursor-pointer items-center gap-2">
                              <input
                                type="checkbox"
                                className="size-4 accent-[var(--navy-900)]"
                                checked={on}
                                onChange={(e) => {
                                  const next = new Set(disabled);
                                  if (e.target.checked) next.delete(r.name);
                                  else next.add(r.name);
                                  setDisabled(next);
                                }}
                              />
                              <span className={on ? "text-ink-900" : "text-ink-500"}>{on ? "On" : "Off"}</span>
                            </label>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!r.essential && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={testing !== null || !on}
                              onClick={async () => {
                                setTesting(r.name);
                                const res = await post(`/api/os-agents/${r.name}`, {}, { fail: `${r.label} did not complete` });
                                setTesting(null);
                                if (res?.output) {
                                  setResult({ agent: r.label, ...res });
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }
                              }}
                            >
                              {testing === r.name ? "Running" : "Test run"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
