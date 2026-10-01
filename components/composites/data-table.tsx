"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowData,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronRight, MoreHorizontal, type LucideIcon } from "lucide-react";
import * as React from "react";
import type { GlyphName } from "@/components/illustrations/empty-glyphs";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    numeric?: boolean;
    /** Identifier column: mono 13px. */
    id?: boolean;
    filterable?: boolean;
    className?: string;
  }
}

export interface RowAction<T> {
  label: string;
  icon?: LucideIcon;
  onSelect: (row: T) => void;
  destructive?: boolean;
}

/**
 * Rows are 56px, the header 40px with the product's only 2px rule (ink).
 * Hover and keyboard focus share a ink-100 wash; focus adds a gold bar that
 * slides in from the left. Clickable rows reveal a chevron on hover.
 */
export function DataTable<T>({
  columns,
  data,
  loading,
  rowActions,
  onRowClick,
  initialSorting = [],
  globalFilter,
  showFilters,
  empty,
  className,
  maxHeight = "calc(100dvh - 280px)",
  mobileCard,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  loading?: boolean;
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T) => void;
  initialSorting?: SortingState;
  globalFilter?: string;
  showFilters?: boolean;
  empty?: { glyph: GlyphName; headline: string; action?: React.ReactNode };
  className?: string;
  maxHeight?: string;
  /** On small screens, render rows as cards instead of a table. */
  mobileCard?: (row: T) => React.ReactNode;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const bodyRef = React.useRef<HTMLTableSectionElement>(null);

  const allColumns = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    const tail: ColumnDef<T, unknown> = {
      id: "__tail",
      size: rowActions?.length ? 72 : 40,
      enableResizing: false,
      enableSorting: false,
      header: () => null,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          {rowActions?.length ? (
            <div className="opacity-0 transition-opacity duration-120 group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-[[data-state=open]]:opacity-100">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Actions for row`} onClick={(e) => e.stopPropagation()} tabIndex={-1}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  {rowActions.map((a) => (
                    <DropdownMenuItem key={a.label} destructive={a.destructive} onSelect={() => a.onSelect(row.original)}>
                      {a.icon && <a.icon />}
                      {a.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
          {onRowClick && (
            <ChevronRight className="size-3.5 -translate-x-1 stroke-[1.5] text-ink-900 opacity-0 transition-[opacity,transform] duration-120 group-hover/row:translate-x-0 group-hover/row:opacity-100 group-focus/row:translate-x-0 group-focus/row:opacity-100" />
          )}
        </div>
      ),
    };
    return [...columns, tail];
  }, [columns, rowActions, onRowClick]);

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: "includesString",
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    defaultColumn: { size: 160, minSize: 64 },
  });

  const rows = table.getRowModel().rows;

  const moveFocus = (e: React.KeyboardEvent<HTMLTableRowElement>, row: T) => {
    const trs = Array.from(bodyRef.current?.querySelectorAll<HTMLTableRowElement>("tr[tabindex]") ?? []);
    const i = trs.indexOf(e.currentTarget);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      trs[i + 1]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      trs[i - 1]?.focus();
    } else if (e.key === "Enter" && onRowClick) {
      onRowClick(row);
    }
  };

  return (
    <div className={cn("relative", className)}>
      {mobileCard && (
        <ul className="flex flex-col gap-3 md:hidden">
          {rows.map((row) => (
            <li key={row.id}>
              {onRowClick ? (
                <button type="button" onClick={() => onRowClick(row.original)} className="block w-full rounded-md border border-ink-200 bg-surface p-4 text-left shadow-card">
                  {mobileCard(row.original)}
                </button>
              ) : (
                <div className="rounded-md border border-ink-200 bg-surface p-4 shadow-card">{mobileCard(row.original)}</div>
              )}
            </li>
          ))}
          {!loading && rows.length === 0 && <EmptyState glyph={empty?.glyph ?? "mandates"} headline={empty?.headline ?? "No rows match these filters."} action={empty?.action} />}
        </ul>
      )}
      <div className={cn("scrollbar-thin overflow-auto", mobileCard && "hidden md:block")} style={{ maxHeight }}>
        <table className="w-full border-separate border-spacing-0" style={{ width: table.getTotalSize(), minWidth: "100%", tableLayout: "fixed" }}>
          <thead className="sticky top-0 z-10 bg-canvas">
            {table.getHeaderGroups().map((hg) => (
              <React.Fragment key={hg.id}>
                <tr>
                  {hg.headers.map((h) => {
                    const meta = h.column.columnDef.meta;
                    const sorted = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        style={{ width: h.getSize() }}
                        className={cn(
                          "eyebrow group/th relative h-10 border-b border-ink-200 bg-canvas px-4 text-left align-middle font-medium whitespace-nowrap select-none",
                          meta?.numeric && "text-right",
                          meta?.className,
                        )}
                        aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      >
                        {h.isPlaceholder ? null : h.column.getCanSort() ? (
                          <button
                            onClick={h.column.getToggleSortingHandler()}
                            className={cn("inline-flex items-baseline gap-1.5 uppercase transition-[color] duration-120 hover:text-ink-900", sorted && "text-ink-900", meta?.numeric && "flex-row-reverse")}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            <span className={cn("num text-axis", !sorted && "opacity-0 group-hover/th:opacity-50")} aria-hidden>
                              {sorted === "asc" ? "↑" : "↓"}
                            </span>
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                        {h.column.getCanResize() && (
                          <span
                            onMouseDown={h.getResizeHandler()}
                            onTouchStart={h.getResizeHandler()}
                            onDoubleClick={() => h.column.resetSize()}
                            className={cn("absolute top-2.5 right-0 bottom-2.5 w-px cursor-col-resize bg-transparent transition-[background-color] duration-120 hover:bg-ink-500", h.column.getIsResizing() && "bg-gold-500")}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
                {showFilters && (
                  <tr>
                    {hg.headers.map((h) => (
                      <th key={h.id} className="border-b border-ink-200 px-2 py-2 font-normal">
                        {h.column.columnDef.meta?.filterable && (
                          <input
                            value={(h.column.getFilterValue() as string) ?? ""}
                            onChange={(e) => h.column.setFilterValue(e.target.value || undefined)}
                            placeholder="Filter"
                            aria-label={`Filter ${String(h.column.columnDef.header)}`}
                            className={cn(
                              "h-8 w-full rounded-sm border border-ink-200 bg-canvas px-2 text-small text-ink-900 placeholder:text-ink-500 focus:border-ink-200 focus:outline-none",
                              h.column.columnDef.meta?.numeric && "text-right",
                            )}
                          />
                        )}
                      </th>
                    ))}
                  </tr>
                )}
              </React.Fragment>
            ))}
          </thead>
          <tbody ref={bodyRef}>
            {loading
              ? Array.from({ length: 8 }, (_, r) => (
                  <tr key={r} className="h-14">
                    {table.getVisibleLeafColumns().map((c) => (
                      <td key={c.id} className="border-b border-ink-200 px-4">
                        {c.id !== "__tail" && <Skeleton className={cn("h-3", c.columnDef.meta?.numeric ? "ml-auto w-16" : c.columnDef.meta?.id ? "w-20" : "w-3/5")} />}
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    onKeyDown={(e) => moveFocus(e, row.original)}
                    className={cn(
                      "group/row h-14 outline-none transition-[background-color] duration-120 hover:bg-ink-100 focus:bg-ink-100",
                      onRowClick && "cursor-pointer",
                    )}
                  >
                    {row.getVisibleCells().map((cell, ci) => {
                      const meta = cell.column.columnDef.meta;
                      return (
                        <td
                          key={cell.id}
                          style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                          className={cn(
                            "truncate border-b border-ink-200 px-4 text-ui text-ink-900",
                            ci === 0 && "relative",
                            meta?.numeric && "num text-right",
                            meta?.id && "num text-small",
                            meta?.className,
                          )}
                        >
                          {ci === 0 && (
                            <span
                              aria-hidden
                              className="absolute inset-y-0 left-0 w-0.5 origin-left -translate-x-full bg-gold-500 transition-transform duration-120 group-focus/row:translate-x-0"
                            />
                          )}
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && <EmptyState glyph={empty?.glyph ?? "mandates"} headline={empty?.headline ?? "No rows match these filters."} action={empty?.action} />}
      </div>
    </div>
  );
}
