"use client";

import { Plus, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface FilterField {
  key: string;
  label: string;
  type: "select" | "text" | "number";
  options?: { value: string; label: string }[];
  /** For number fields: the comparison applied (shown in the chip). */
  op?: ">=" | "<=";
}

export type FilterValue = Record<string, string>;

/** Chips for active filters; "Add filter" picks a field, then a value. */
export function FilterBuilder({ fields, value, onChange }: { fields: FilterField[]; value: FilterValue; onChange: (v: FilterValue) => void }) {
  const [editing, setEditing] = React.useState<FilterField | null>(null);
  const [draft, setDraft] = React.useState("");
  const active = fields.filter((f) => value[f.key]);
  const remaining = fields.filter((f) => !value[f.key]);
  const display = (f: FilterField, v: string) => (f.type === "select" ? (f.options?.find((o) => o.value === v)?.label ?? v) : f.op ? `${f.op} ${v}` : v);
  const commit = () => {
    if (editing && draft.trim()) onChange({ ...value, [editing.key]: draft.trim() });
    setEditing(null);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filters">
      {active.map((f) => (
        <span key={f.key} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-ink-200 bg-surface pr-1 pl-3 text-small">
          <span className="text-ink-500">{f.label}</span>
          <span className="text-ink-900">{display(f, value[f.key]!)}</span>
          <button
            type="button"
            aria-label={`Remove ${f.label} filter`}
            className="rounded-full p-1 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
            onClick={() => {
              const next = { ...value };
              delete next[f.key];
              onChange(next);
            }}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {remaining.length > 0 && (
        <Popover open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
          <DropdownMenu>
            <PopoverTrigger asChild>
              <span>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Plus /> Add filter
                  </Button>
                </DropdownMenuTrigger>
              </span>
            </PopoverTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Filter by</DropdownMenuLabel>
              {remaining.map((f) => (
                <DropdownMenuItem
                  key={f.key}
                  onSelect={() => {
                    setDraft("");
                    setTimeout(() => setEditing(f), 0);
                  }}
                >
                  {f.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <PopoverContent align="start" className="w-64 p-3">
            {editing && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  commit();
                }}
              >
                <div className="eyebrow mb-2">{editing.label}</div>
                {editing.type === "select" ? (
                  <ul className="flex flex-col">
                    {editing.options?.map((o) => (
                      <li key={o.value}>
                        <button
                          type="button"
                          className="w-full rounded-xs px-2 py-1.5 text-left text-small text-ink-700 hover:bg-ink-100 hover:text-ink-900"
                          onClick={() => {
                            onChange({ ...value, [editing.key]: o.value });
                            setEditing(null);
                          }}
                        >
                          {o.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex gap-2">
                    <input autoFocus inputMode={editing.type === "number" ? "decimal" : "text"} className="h-8 w-full rounded-sm border border-ink-200 px-2 text-small outline-none focus:border-navy-900" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={editing.op ? `${editing.op} value` : "Contains"} />
                    <Button size="sm" type="submit">
                      Apply
                    </Button>
                  </div>
                )}
              </form>
            )}
          </PopoverContent>
        </Popover>
      )}
      {active.length > 0 && (
        <Button variant="link" size="sm" onClick={() => onChange({})}>
          Clear all
        </Button>
      )}
    </div>
  );
}
