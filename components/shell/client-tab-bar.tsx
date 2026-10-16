"use client";

import { FolderOpen, Home, MessageSquare, PieChart, Target, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useNavLabel } from "./use-nav-label";

const TABS: { href: string; label: string; Icon: LucideIcon; tint: string }[] = [
  { href: "/client/home", label: "Home", Icon: Home, tint: "text-sea-600" },
  { href: "/client/portfolio", label: "Portfolio", Icon: PieChart, tint: "text-iris-600" },
  { href: "/client/opportunities", label: "Opportunities", Icon: Target, tint: "text-coral-600" },
  { href: "/client/messages", label: "Messages", Icon: MessageSquare, tint: "text-sky-600" },
  { href: "/client/documents", label: "Documents", Icon: FolderOpen, tint: "text-sun-600" },
];

/** The portal on a phone: the five places clients go most, one thumb away. Hidden from 1024px, where the sidebar takes over. */
export function ClientTabBar() {
  const pathname = usePathname();
  const tr = useNavLabel();
  return (
    <nav aria-label="Portal" data-no-print className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
      <ul className="mx-auto grid max-w-[560px] grid-cols-5">
        {TABS.map(({ href, label, Icon, tint }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className="flex h-16 flex-col items-center justify-center gap-1 text-[11px] leading-none">
                <span className={cn("grid h-7 w-12 place-items-center rounded-full transition-[background-color] duration-150", active ? "bg-ink-100" : "bg-transparent")}>
                  <Icon className={cn("size-5 stroke-[1.75] transition-colors duration-150", active ? tint : "text-ink-500")} aria-hidden />
                </span>
                <span className={cn("max-w-full truncate px-1", active ? "font-medium text-ink-900" : "text-ink-500")}>{tr(label)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
