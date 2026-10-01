import { cn } from "@/lib/utils";

export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <kbd className={cn("num inline-flex h-5 items-center rounded-xs border border-ink-200 px-1.5 text-axis text-ink-500", className)} {...props} />;
}
