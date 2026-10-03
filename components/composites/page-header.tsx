import { useTranslations } from "next-intl";
import { navKey } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Page header: an 11px uppercase eyebrow, the title in Playfair (40px, 32px
 * on phones), a 14px ink-500 subtitle, and the primary action on the right.
 * A single hairline closes it; there is no card around it.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  meta,
  badge,
  className,
  rule = true,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  /** A status badge beside the eyebrow (for example, demo data). */
  badge?: React.ReactNode;
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
      {(eyebrow || badge) && (
        <div className="mb-3 flex items-center gap-3">
          {eyebrow && <div className="label-caps">{eyebrow}</div>}
          {badge}
        </div>
      )}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-page-sm font-medium text-navy-900 md:text-title">{title}</h1>
          {subtitle && <p className="mt-3 max-w-[64ch] text-ui text-ink-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 lg:pb-1">{actions}</div>}
      </div>
      {meta && <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-meta text-ink-500">{meta}</div>}
    </header>
  );
}
