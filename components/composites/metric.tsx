import { cn } from "@/lib/utils";

/** Label over a mono value; for dense fact grids. */
export function Metric({ label, value, sub, className, size = "md" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; className?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="eyebrow truncate">{label}</dt>
      <dd className={cn("num mt-1.5 truncate text-ink-900", size === "lg" ? "text-card" : size === "sm" ? "text-ui" : "text-read")}>{value}</dd>
      {sub && <dd className="mt-0.5 truncate text-small text-ink-500">{sub}</dd>}
    </div>
  );
}

export function MetricGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-4", className)}>{children}</dl>;
}
