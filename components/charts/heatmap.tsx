import { cn } from "@/lib/utils";

/** Single-hue sequential heatmap: navy tints on paper. Negative values fall to the paper end. */
export function Heatmap({ rows, cols, values }: { rows: string[]; cols: string[]; values: { region: string; assetClass: string; value: number }[] }) {
  const nums = values.map((v) => v.value);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const lookup = new Map(values.map((v) => [`${v.region}|${v.assetClass}`, v.value]));
  const pct = (v: number) => Math.round(6 + ((v - min) / (max - min || 1)) * 94);
  return (
    <figure className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-px">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="pb-2 text-center text-small font-normal text-ink-3">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <th className="pr-4 text-left text-small font-normal whitespace-nowrap text-ink-2">{r}</th>
              {cols.map((c) => {
                const v = lookup.get(`${r}|${c}`) ?? 0;
                const p = pct(v);
                return (
                  <td
                    key={c}
                    title={`${r}, ${c}: ${v.toFixed(1)}%`}
                    className={cn("num h-10 min-w-[52px] text-center text-small", p > 55 ? "text-paper" : "text-ink")}
                    style={{ background: `color-mix(in oklab, var(--navy) ${p}%, var(--paper))` }}
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
      <figcaption className="mt-4 flex items-center justify-end gap-3">
        <span className="num text-axis text-ink-3">{min.toFixed(1)}%</span>
        <span className="h-1.5 w-32" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--navy) 6%, var(--paper)), var(--navy))" }} />
        <span className="num text-axis text-ink-3">{max.toFixed(1)}%</span>
      </figcaption>
    </figure>
  );
}
