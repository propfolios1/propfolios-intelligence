import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  ["/admin/website", "Editor"],
  ["/admin/website/theme", "Theme"],
  ["/admin/website/domain", "Domain"],
  ["/admin/website/seo", "Search and sharing"],
] as const;

export function WebsiteTabs({ active, url }: { active: string; url: string }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-hairline">
      <nav className="flex gap-6" aria-label="Website settings">
        {TABS.map(([href, label]) => (
          <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={cn("relative pb-3 text-ui transition-colors duration-150", active === href ? "text-ink-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-gold-500" : "text-ink-500 hover:text-ink-900")}>
            {label}
          </Link>
        ))}
      </nav>
      <span className="num pb-3 text-[12px] text-ink-500">{url}</span>
    </div>
  );
}
