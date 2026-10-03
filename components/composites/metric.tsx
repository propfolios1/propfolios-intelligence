import { cn } from "@/lib/utils";

/** Label over a value for dense fact grids. Figures are set in mono; names and words stay in Inter. */
export function Metric({ label, value, sub, className, size = "md" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string; size?: "sm" | "md" | "lg" }) {
  const numeric = typeof value === "string" && /^[A-Z$₹]{0,4}\s?[−+-]?[\d.,]+/.test(value.trim());
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="label-caps truncate">{label}</dt>
      <dd className={cn("mt-1 truncate text-ink-900", numeric ? "num" : "font-medium", size === "lg" ? "text-card" : "text-ui")} title={typeof value === "string" ? value : undefined}>
        {value}
      </dd>
      {sub && <dd className="mt-0.5 truncate text-meta text-ink-500">{sub}</dd>}
    </div>
  );
}

export function MetricGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4", className)}>{children}</dl>;
}
