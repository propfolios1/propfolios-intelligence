import Link from "next/link";
import { cn } from "@/lib/utils";

const TABS = [
  ["/admin/whatsapp", "Inbox and settings"],
  ["/admin/whatsapp/templates", "Templates"],
  ["/admin/whatsapp/broadcasts", "Broadcasts"],
] as const;

export function WhatsappTabs({ active }: { active: string }) {
  return (
    <nav className="mt-6 flex gap-6 border-b border-hairline" aria-label="WhatsApp">
      {TABS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={active === href ? "page" : undefined} className={cn("relative pb-3 text-ui transition-colors duration-150", active === href ? "text-ink-900 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-gold-500" : "text-ink-500 hover:text-ink-900")}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
