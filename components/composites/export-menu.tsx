"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";

export interface ExportColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function download(name: string, type: string, body: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV and JSON of the rows on screen, plus an optional PDF from the server. */
export function ExportMenu<T>({ rows, columns, filename, pdfHref }: { rows: T[]; columns: ExportColumn<T>[]; filename: string; pdfHref?: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm">
          <Download /> Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() => {
            const lines = [columns.map((c) => csvCell(c.header)).join(","), ...rows.map((r) => columns.map((c) => csvCell(c.value(r))).join(","))];
            download(`${filename}.csv`, "text/csv;charset=utf-8", `﻿${lines.join("\n")}`);
            toast.success(`Exported ${rows.length} rows`);
          }}
        >
          CSV (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            download(`${filename}.json`, "application/json", JSON.stringify(rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, c.value(r) ?? null]))), null, 2));
            toast.success(`Exported ${rows.length} rows`);
          }}
        >
          JSON
        </DropdownMenuItem>
        {pdfHref && (
          <DropdownMenuItem asChild>
            <a href={pdfHref}>PDF</a>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
