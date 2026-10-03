import { ArrowRight, Briefcase, FileText, Inbox, type LucideIcon, Target } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GlyphName = "mandates" | "documents" | "opportunities" | "inbox";
const ICON: Record<GlyphName, LucideIcon> = { mandates: Briefcase, documents: FileText, opportunities: Target, inbox: Inbox };

export interface EmptyAction {
  label: string;
  href: string;
}

/**
 * Empty state: a 24px line icon in ink-300, an 18px headline, 14px subtext
 * that says what happens next, a primary action and a ghost link beneath.
 * Centred in a 400px column, 96px from the content above. No illustration.
 */
export function EmptyState({
  glyph = "inbox",
  icon,
  headline,
  note,
  primary,
  secondary,
  action,
  className,
  compact,
}: {
  glyph?: GlyphName;
  icon?: LucideIcon;
  headline: string;
  note?: string;
  primary?: EmptyAction;
  secondary?: EmptyAction;
  /** A custom primary control (a dialog trigger or a form button) in place of `primary`. */
  action?: React.ReactNode;
  className?: string;
  /** Inside a panel: 48px from the top instead of 96px. */
  compact?: boolean;
}) {
  const Icon = icon ?? ICON[glyph];
  return (
    <div className={cn("mx-auto flex max-w-[400px] flex-col items-center px-4 text-center", compact ? "py-12" : "pt-24 pb-16", className)}>
      <Icon className="size-6 stroke-[1.5] text-ink-300" aria-hidden />
      <p className="mt-4 text-card font-medium text-ink-900">{headline}</p>
      {note && <p className="mt-2 max-w-[360px] text-ui text-ink-500">{note}</p>}
      {(action || primary) && (
        <div className="mt-6">
          {action ?? (
            <Link href={primary!.href} className={buttonVariants({ variant: "primary" })}>
              {primary!.label}
            </Link>
          )}
        </div>
      )}
      {secondary && (
        <Link href={secondary.href} className="mt-3 inline-flex items-center gap-2 text-ui text-ink-700 transition-colors duration-150 hover:text-ink-900">
          {secondary.label}
          <ArrowRight className="size-3.5 stroke-[1.5]" aria-hidden />
        </Link>
      )}
    </div>
  );
}
