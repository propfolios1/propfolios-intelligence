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
import { ArrowDown, ArrowUp, ChevronsUpDown, Inbox, ListFilter, MoreHorizontal, type LucideIcon } from "lucide-react";
import * as React from "react";
import { EmptyState } from "./empty-state";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Skeleton } from "./ui/skeleton";
import { cn } from "@/lib/utils";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    numeric?: boolean;
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

const ROW_H = "h-12";

export function DataTable<T>({
  columns,
  data,
  loading,
  rowActions,
  onRowClick,
  initialSorting = [],
  globalFilter,
  empty,
  dense,
  className,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  loading?: boolean;
  rowActions?: RowAction<T>[];
  onRowClick?: (row: T) => void;
  initialSorting?: SortingState;
  globalFilter?: string;
  empty?: { icon?: LucideIcon; headline: string; subtext?: string; action?: React.ReactNode };
  dense?: boolean;
  className?: string;
}) {
  const [sorting, setSorting] = React.useState<SortingState>(initialSorting);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [showFilters, setShowFilters] = React.useState(false);

  const allColumns = React.useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!rowActions?.length) return columns;
    return [
      ...columns,
      {
        id: "__actions",
        size: 52,
        enableResizing: false,
        enableSorting: false,
        header: () => null,
        cell: ({ row }) => (
          <div className="flex justify-end opacity-0 transition-opacity duration-150 group-hover/row:opacity-100 has-[[data-state=open]]:opacity-100">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="Row actions" onClick={(e) => e.stopPropagation()}>
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
        ),
      },
    ];
  }, [columns, rowActions]);

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
  const hasFilterable = columns.some((c) => c.meta?.filterable);

  return (
    <div className={cn("overflow-hidden rounded-card border border-ink-200 bg-surface shadow-card", className)}>
      <div className="scrollbar-thin max-h-[calc(100dvh-260px)] min-h-[200px] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-sm" style={{ width: table.getTotalSize(), minWidth: "100%", tableLayout: "fixed" }}>
          <thead className="sticky top-0 z-10 bg-surface">
            {table.getHeaderGroups().map((hg) => (
              <React.Fragment key={hg.id}>
                <tr>
                  {hg.headers.map((h, i) => {
                    const meta = h.column.columnDef.meta;
                    const sorted = h.column.getIsSorted();
                    return (
                      <th
                        key={h.id}
                        style={{ width: h.getSize() }}
                        className={cn(
                          "eyebrow group/th relative h-10 border-b border-ink-200 px-4 text-left font-medium whitespace-nowrap select-none",
                          meta?.numeric && "text-right",
                          meta?.className,
                        )}
                      >
                        {h.isPlaceholder ? null : h.column.getCanSort() ? (
                          <button
                            onClick={h.column.getToggleSortingHandler()}
                            className={cn("inline-flex items-center gap-1 hover:text-ink-900", meta?.numeric && "flex-row-reverse")}
                          >
                            {flexRender(h.column.columnDef.header, h.getContext())}
                            {sorted === "asc" ? (
                              <ArrowUp className="size-3" />
                            ) : sorted === "desc" ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ChevronsUpDown className="size-3 opacity-0 group-hover/th:opacity-60" />
                            )}
                          </button>
                        ) : (
                          flexRender(h.column.columnDef.header, h.getContext())
                        )}
                        {i === hg.headers.length - 1 && hasFilterable && (
                          <button
                            onClick={() => setShowFilters((s) => !s)}
                            aria-label="Toggle column filters"
                            className={cn(
                              "absolute top-1/2 right-2 -translate-y-1/2 rounded-[4px] p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-900",
                              showFilters && "bg-navy-100 text-navy-900",
                            )}
                          >
                            <ListFilter className="size-3.5" />
                          </button>
                        )}
                        {h.column.getCanResize() && (
                          <div
                            onMouseDown={h.getResizeHandler()}
                            onTouchStart={h.getResizeHandler()}
                            onDoubleClick={() => h.column.resetSize()}
                            className={cn(
                              "absolute top-2 right-0 bottom-2 w-1 cursor-col-resize touch-none border-r border-transparent hover:border-ink-300",
                              h.column.getIsResizing() && "border-navy-500",
                            )}
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
                {showFilters && (
                  <tr>
                    {hg.headers.map((h) => (
                      <th key={h.id} className="border-b border-ink-200 px-2 py-1.5 font-normal">
                        {h.column.columnDef.meta?.filterable && (
                          <input
                            value={(h.column.getFilterValue() as string) ?? ""}
                            onChange={(e) => h.column.setFilterValue(e.target.value || undefined)}
                            placeholder="Filter…"
                            className={cn(
                              "h-7 w-full rounded-[4px] border border-ink-200 bg-surface px-2 text-xs text-ink-900 normal-case placeholder:text-ink-400 focus:border-navy-500 focus:outline-none",
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
          <tbody>
            {loading
              ? Array.from({ length: 8 }, (_, r) => (
                  <tr key={r} className={dense ? "h-10" : ROW_H}>
                    {table.getVisibleLeafColumns().map((c) => (
                      <td key={c.id} className="border-b border-ink-200 px-4">
                        <Skeleton className={cn("h-3.5", c.columnDef.meta?.numeric ? "ml-auto w-14" : "w-3/5")} />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={cn(
                      "group/row transition-[background-color] duration-150 ease-brand hover:bg-ink-50",
                      dense ? "h-10" : ROW_H,
                      onRowClick && "cursor-pointer",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{ width: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                        className={cn(
                          "truncate border-b border-ink-200 px-4 text-ink-800 group-last/row:border-b-0",
                          cell.column.columnDef.meta?.numeric && "num text-right",
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 && (
          <EmptyState
            icon={empty?.icon ?? Inbox}
            headline={empty?.headline ?? "Nothing here yet"}
            subtext={empty?.subtext ?? "Try adjusting your filters."}
            action={empty?.action}
          />
        )}
      </div>
    </div>
  );
}
