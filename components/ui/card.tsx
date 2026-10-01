import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, interactive, ...props }: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-md border border-ink-200 bg-surface shadow-card",
        interactive && "transition-[transform,border-color] duration-250 ease-out hover:-translate-y-px hover:border-ink-400",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, eyebrow, title, actions, ...props }: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & { eyebrow?: React.ReactNode; title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-6 pt-5 pb-4", className)} {...props}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
        {title && <h3 className="text-body font-medium text-ink-900">{title}</h3>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-6 pb-6", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 border-t border-ink-200 px-6 py-4", className)} {...props} />;
}
