import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  numeric?: boolean;
  className?: string;
}

/**
 * Stripe-style table: no outer border, no cell borders, no zebra. Header 32px
 * in 11px uppercase over a hairline; rows exactly 40px with a row hairline;
 * 12px cell padding; numbers right-aligned in 13px mono. Scrolls sideways on
 * narrow screens.
 */
export function SimpleTable<T>({ rows, columns, empty = "No records yet.", minWidth = 720, className }: { rows: T[]; columns: Column<T>[]; empty?: string; minWidth?: number; className?: string }) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-ui" style={{ minWidth }}>
        <thead className="text-start">
          <tr className="h-8 border-b border-hairline">
            {columns.map((c) => (
              <th key={c.key} className={cn("label-caps px-3 text-start align-middle whitespace-nowrap first:ps-0", c.numeric && "text-end")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-8 text-start text-ui text-ink-500">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={i} className="h-10 border-b border-hairline-row transition-colors duration-150 hover:bg-ink-50">
                {columns.map((c, ci) => (
                  <td key={c.key} className={cn("px-3 py-0 align-middle first:ps-0", ci === 0 ? "text-ink-900" : "text-ink-700", c.numeric && "num text-end text-mono whitespace-nowrap text-ink-900", c.className)}>
                    {c.numeric ? c.cell(r) : <div className="cell-line max-w-[28rem]">{c.cell(r)}</div>}
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
          <h2 className="font-display text-section text-navy-900">{title}</h2>
          {description && <p className="mt-1 max-w-[70ch] text-small text-ink-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
