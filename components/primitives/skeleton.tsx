import { cn } from "@/lib/utils";

/** A shape of the final content. Always sized to match what it replaces. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span aria-hidden className={cn("skeleton block", className)} {...props} />;
}
