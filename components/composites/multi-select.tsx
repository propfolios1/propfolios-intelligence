"use client";

import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** A filter set in type: "Status  All ⌄". Active filters are underlined in ink. */
export function MultiSelect({ label, options, value, onChange }: { label: string; options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  const summary = value.length === 0 ? "All" : value.length === 1 ? options.find((o) => o.value === value[0])?.label : `${value.length} selected`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex h-10 items-baseline gap-2 text-small outline-none">
        <span className="eyebrow">{label}</span>
        <span className={cn("max-w-[160px] truncate border-b pb-px transition-[border-color] duration-120", value.length ? "border-hairline text-ink-900" : "border-transparent text-ink-700 group-hover:border-hairline")}>{summary}</span>
        <span className="num text-axis text-ink-500" aria-hidden>
          ▾
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-[320px] w-60 overflow-y-auto">
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={value.includes(o.value)}
            onCheckedChange={(c) => onChange(c ? [...value, o.value] : value.filter((v) => v !== o.value))}
            onSelect={(e) => e.preventDefault()}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
        {value.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChange([])}>Clear</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
