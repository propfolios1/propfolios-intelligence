import { cn } from "@/lib/utils";

/**
 * Eyebrow, Instrument Serif title, a sentence of context, actions on the right.
 * A single rule closes the header; there is no card around it.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
  className,
  rule = true,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
  rule?: boolean;
}) {
  return (
    <header className={cn(rule && "border-b border-rule pb-8", className)}>
      {eyebrow && <div className="eyebrow mb-5">{eyebrow}</div>}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-section text-navy md:text-title">{title}</h1>
          {subtitle && <p className="mt-4 max-w-[60ch] text-body text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3 lg:pb-1.5">{actions}</div>}
      </div>
      {meta && <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-ink-2">{meta}</div>}
    </header>
  );
}
