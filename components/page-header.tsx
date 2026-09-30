import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
        <h1 className="font-display text-section font-medium text-navy-900 md:text-page">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-lead text-ink-600">{subtitle}</p>}
        {meta && <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-secondary text-ink-500">{meta}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
