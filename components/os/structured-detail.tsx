import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { cn } from "@/lib/utils";

const CORE = new Set(["headline", "points", "confidence"]);
const label = (k: string) => k.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

const TONES: Record<string, PillTone> = { pass: "complete", warn: "progress", fail: "error", CRITICAL: "error", HIGH: "error", MEDIUM: "progress", LOW: "neutral", COMPLIANT: "complete", CONDITIONS: "progress", NON_COMPLIANT: "error", CLEAR: "complete", CONDITIONAL: "progress", BLOCKED: "error", PROCEED: "complete", RENEGOTIATE: "progress", DOCUMENT_JUSTIFICATION: "progress" };

function Cell({ v }: { v: unknown }) {
  if (v === null || v === undefined || v === "") return <span className="text-ink-400">None</span>;
  if (typeof v === "boolean") return <span>{v ? "Yes" : "No"}</span>;
  if (typeof v === "number") return <span className="num">{Number.isInteger(v) ? v.toLocaleString("en-IN") : v.toFixed(2)}</span>;
  if (typeof v === "string") return TONES[v] ? <StatusPill tone={TONES[v]}>{v.replace(/_/g, " ")}</StatusPill> : <span>{v}</span>;
  if (Array.isArray(v) && v.length === 0) return <span className="text-ink-400">None</span>;
  if (Array.isArray(v)) return <span>{v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")}</span>;
  return (
    <span className="block space-y-0.5">
      {Object.entries(v as Record<string, unknown>).map(([k, x]) => (
        <span key={k} className="flex justify-between gap-4">
          <span className="text-ink-500">{label(k.replace(/^d(\d)/, "$1").replace(/_/g, " to "))}</span>
          <Cell v={x} />
        </span>
      ))}
    </span>
  );
}

/** Renders the agent-specific part of an output: scalar fields as a definition list, arrays of records as tables. */
export function StructuredDetail({ output, className }: { output: Record<string, unknown>; className?: string }) {
  const entries = Object.entries(output).filter(([k]) => !CORE.has(k));
  const lists = entries.filter(([, v]) => Array.isArray(v) && v.length > 1 && typeof v[0] === "string") as [string, string[]][];
  const scalars = entries.filter(([, v]) => (!Array.isArray(v) || !v.length || typeof v[0] !== "object") && !(Array.isArray(v) && v.length > 1 && typeof v[0] === "string"));
  const tables = entries.filter(([, v]) => Array.isArray(v) && v.length && typeof v[0] === "object") as [string, Record<string, unknown>[]][];
  return (
    <div className={cn("space-y-6", className)}>
      {scalars.length > 0 && (
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {scalars.map(([k, v]) => (
            <div key={k}>
              <dt className="eyebrow">{label(k)}</dt>
              <dd className="mt-1 text-small text-ink-900">
                <Cell v={v} />
              </dd>
            </div>
          ))}
        </dl>
      )}
      {lists.map(([k, items]) => (
        <div key={k}>
          <div className="eyebrow mb-2">{label(k)}</div>
          <ul className="list-disc space-y-1 pl-5 text-small text-ink-700">
            {items.map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </div>
      ))}
      {tables.map(([k, rows]) => {
        const cols = Object.keys(rows[0]!);
        return (
          <div key={k}>
            <div className="eyebrow mb-2">{label(k)}</div>
            <div className="overflow-x-auto rounded-md border border-hairline">
              <table className="w-full min-w-[560px] text-small">
                <thead className="bg-navy-50 text-left text-ink-500">
                  <tr>
                    {cols.map((c) => (
                      <th key={c} className="px-3 py-2 font-medium">
                        {label(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-hairline align-top">
                      {cols.map((c) => (
                        <td key={c} className="px-3 py-2 text-ink-700">
                          <Cell v={r[c]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
