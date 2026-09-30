import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  headline,
  subtext,
  action,
  className,
}: {
  icon: LucideIcon;
  headline: string;
  subtext?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto flex max-w-[400px] flex-col items-center px-6 py-16 text-center", className)}>
      <Icon className="size-6 text-ink-400" strokeWidth={1.5} />
      <h3 className="mt-4 text-lead font-medium text-ink-900">{headline}</h3>
      {subtext && <p className="mt-1.5 text-secondary text-ink-500">{subtext}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
