import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  ["/admin/sso", "Single sign-on"],
  ["/admin/scim", "SCIM provisioning"],
  ["/admin/roles", "Roles"],
  ["/admin/api", "API"],
  ["/admin/audit/export", "Audit export"],
  ["/admin/data-residency", "Data residency"],
] as const;

export function EnterpriseTabs({ active }: { active: string }) {
  return (
    <nav className="mt-6 flex gap-6 overflow-x-auto border-b border-hairline" aria-label="Enterprise controls">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={cn("relative shrink-0 pb-3 text-ui transition-colors duration-150", active === href ? "text-ink-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-gold-500" : "text-ink-500 hover:text-ink-900")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Shown on Enterprise controls when the firm's plan does not include them. */
export function PlanNote({ plan, feature }: { plan: string; feature: string }) {
  if (plan === "enterprise" || plan === "white_label") return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline border-l-2 border-l-gold-500 bg-surface px-4 py-3">
      <p className="text-small text-ink-700">{feature} is included in the Enterprise and White-label plans. You can configure it now; it switches on when the firm upgrades.</p>
      <Link href="/admin/billing" className="text-ui font-medium text-navy-900 underline decoration-ink-200 underline-offset-4">
        View plans
      </Link>
    </div>
  );
}
