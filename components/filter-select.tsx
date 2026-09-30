"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "./ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function MultiSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const summary = value.length === 0 ? "All" : value.length === 1 ? options.find((o) => o.value === value[0])?.label : `${value.length} selected`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" className={cn("justify-between gap-2 font-normal", value.length > 0 && "border-navy-300")}>
          <span className="text-ink-500">{label}</span>
          <span className="max-w-[140px] truncate text-ink-900">{summary}</span>
          <ChevronDown className="text-ink-400" />
        </Button>
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
            <DropdownMenuItem onSelect={() => onChange([])}>Clear selection</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
