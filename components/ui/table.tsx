import * as React from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-md border border-hairline bg-surface shadow-card">
      <table className={cn("w-full border-separate border-spacing-0 text-ui", className)} {...props} />
    </div>
  );
}
export function THead(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className="bg-surface" {...props} />;
}
export function TH({ className, numeric, ...props }: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <th className={cn("eyebrow h-10 border-b border-hairline px-4 text-left font-medium", numeric && "text-right", className)} {...props} />;
}
export function TR({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn("transition-colors duration-150 hover:bg-navy-50", className)} {...props} />;
}
export function TD({ className, numeric, ...props }: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return <td className={cn("h-13 border-b border-hairline px-4 text-ink-900 group-last:border-0", numeric && "num text-right", className)} {...props} />;
}
