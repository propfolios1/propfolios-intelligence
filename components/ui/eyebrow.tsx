import { cn } from "@/lib/utils";

export function Eyebrow({ as: Tag = "div", className, ...props }: React.HTMLAttributes<HTMLElement> & { as?: "div" | "span" | "p" | "h2" | "h3" | "dt" | "legend" }) {
  return <Tag className={cn("eyebrow", className)} {...props} />;
}
