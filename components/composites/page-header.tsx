import { useTranslations } from "next-intl";
import { navKey } from "@/lib/i18n/config";
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
  const t = useTranslations("nav");
  // Titles and eyebrows that are navigation labels follow the interface language; other copy stays as written.
  const tr = (v: React.ReactNode) => (typeof v === "string" ? v.split(" · ").map((p) => (t.has(navKey(p)) ? t(navKey(p)) : p)).join(" · ") : v);
  title = tr(title);
  eyebrow = tr(eyebrow);
  return (
    <header className={cn(rule && "border-b border-hairline pb-8", className)}>
      {eyebrow && <div className="eyebrow mb-5">{eyebrow}</div>}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-section text-navy-900 md:text-title">{title}</h1>
          {subtitle && <p className="mt-4 max-w-[60ch] text-body text-ink-700">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-3 lg:pb-1.5">{actions}</div>}
      </div>
      {meta && <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-ink-700">{meta}</div>}
    </header>
  );
}
