import { cn } from "@/lib/utils";

/**
 * Month-on-month change by region. Positive cells step through navy tints,
 * negative cells through the danger tint; values are always printed.
 */
export function Heatmap({ rows, cols, values, unit = "%" }: { rows: string[]; cols: string[]; values: number[][]; unit?: string }) {
  const max = Math.max(...values.flat().map((v) => Math.abs(v)), 0.1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-separate border-spacing-1 text-axis" aria-label="Month-on-month price change by region">
        <thead>
          <tr>
            <th className="w-32" />
            {cols.map((c) => (
              <th key={c} scope="col" className="num px-1 pb-1 text-center font-normal text-ink-500">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r}>
              <th scope="row" className="pr-3 text-left text-small font-normal text-ink-700">
                {r}
              </th>
              {values[i]!.map((v, j) => {
                const strength = Math.round((Math.abs(v) / max) * 70) + 8;
                return (
                  <td
                    key={j}
                    title={`${r}, ${cols[j]}: ${v > 0 ? "+" : ""}${v.toFixed(1)}${unit}`}
                    className={cn("num h-9 rounded-xs text-center", strength > 45 ? "text-surface" : "text-ink-900")}
                    style={{ background: `color-mix(in oklab, ${v >= 0 ? "var(--navy-900)" : "var(--danger)"} ${strength}%, var(--surface))` }}
                  >
                    {v > 0 ? "+" : ""}
                    {v.toFixed(1)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
