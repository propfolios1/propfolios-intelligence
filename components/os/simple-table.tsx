import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  numeric?: boolean;
  className?: string;
}

/** Dense bordered table with horizontal scroll on narrow screens; numeric columns right-aligned in mono. */
export function SimpleTable<T>({ rows, columns, empty = "No records.", minWidth = 720, className }: { rows: T[]; columns: Column<T>[]; empty?: string; minWidth?: number; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-md border border-ink-200 bg-surface shadow-card", className)}>
      <table className="w-full text-small" style={{ minWidth }}>
        <thead className="border-b border-ink-200 bg-navy-50 text-left">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn("px-4 py-2.5 text-axis font-medium tracking-[0.06em] text-ink-500 uppercase", c.numeric && "text-right")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="border-t border-ink-200 align-top first:border-t-0 hover:bg-navy-50/50">
                {columns.map((c) => (
                  <td key={c.key} className={cn("px-4 py-3 text-ink-700", c.numeric && "num text-right text-ink-900", c.className)}>
                    {c.cell(r)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Section({ title, eyebrow, description, actions, children, className }: { title: string; eyebrow?: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("mt-10", className)}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
          <h2 className="font-display text-[22px] text-navy-900">{title}</h2>
          {description && <p className="mt-1 max-w-[70ch] text-small text-ink-700">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
