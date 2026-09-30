import { formatCompact } from "@/lib/utils";

/**
 * Portfolio allocation as one horizontal stacked bar, not a pie. Segments step
 * through navy tints by weight; labels sit below, aligned to each segment.
 */
export function AllocationBar({ items }: { items: { label: string; value: number }[] }) {
  const sorted = [...items].sort((a, b) => b.value - a.value);
  const total = sorted.reduce((s, i) => s + i.value, 0) || 1;
  const shades = [100, 72, 50, 34, 22, 14];
  return (
    <figure>
      <div className="flex h-3 w-full gap-px bg-paper" role="img" aria-label={sorted.map((s) => `${s.label} ${((s.value / total) * 100).toFixed(0)}%`).join(", ")}>
        {sorted.map((s, i) => (
          <span key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: `color-mix(in oklab, var(--navy) ${shades[i] ?? 10}%, var(--paper))` }} />
        ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
        {sorted.map((s, i) => (
          <div key={s.label} className="border-t border-rule pt-2.5">
            <dt className="flex items-center gap-2 text-small text-ink-2">
              <span className="size-2" style={{ background: `color-mix(in oklab, var(--navy) ${shades[i] ?? 10}%, var(--paper))` }} />
              {s.label}
            </dt>
            <dd className="num mt-1 text-ui text-ink">
              {((s.value / total) * 100).toFixed(0)}%<span className="ml-2 text-small text-ink-3">${formatCompact(s.value)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  );
}
