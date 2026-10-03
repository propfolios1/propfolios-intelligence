import * as React from "react";
import { cn } from "@/lib/utils";

/** Table primitives to the Stripe spec: no outer border, 32px header, 40px rows, row hairlines, mono right-aligned numbers. */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-separate border-spacing-0 text-ui", className)} {...props} />
    </div>
  );
}
export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}
export function TH({ className, numeric, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th className={cn("label-caps h-8 border-b border-hairline px-3 text-start align-middle whitespace-nowrap first:ps-0", numeric && "text-end", className)} {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("group transition-colors duration-150 hover:bg-ink-50", className)} {...props} />;
}
export function TD({ className, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("h-10 border-b border-hairline-row px-3 py-2 align-middle text-ink-700 first:ps-0 first:text-ink-900", numeric && "num text-end text-mono text-ink-900", className)} {...props} />;
}
