import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Bell, Briefcase, Building2, Inbox, LayoutGrid } from "lucide-react";
import { MobileRuntime } from "@/components/mobile/runtime";
import { requireRole } from "@/lib/auth";
import { getTenantById } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Nakhla", appleWebApp: { capable: true, title: "Nakhla", statusBarStyle: "black-translucent" }, manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#0A1F44", width: "device-width", initialScale: 1, viewportFit: "cover" };

const TABS = [
  ["/m/dashboard", "Today", LayoutGrid],
  ["/m/leads", "Leads", Inbox],
  ["/m/listings", "Listings", Building2],
  ["/m/deals", "Deals", Briefcase],
  ["/m/more", "More", Bell],
] as const;

export default async function MobileLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const t = await getTenantById(user.tenantId);
  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col bg-canvas">
      <header className="sticky top-0 z-20 border-b border-hairline bg-surface/95 backdrop-blur-[8px]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex h-12 items-center justify-between px-4">
          <span className="text-[13px] font-semibold tracking-[0.12em] text-navy-900 uppercase">{t?.configJson.brand_name ?? t?.name}</span>
          <span className="text-[12px] text-ink-500">{user.name}</span>
        </div>
        <MobileRuntime />
      </header>
      <main className="flex-1 px-4 pt-4 pb-24">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[560px] border-t border-hairline bg-surface" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} aria-label="Agent app">
        <ul className="grid grid-cols-5">
          {TABS.map(([href, label, Icon]) => (
            <li key={href}>
              <Link href={href} className="flex h-14 flex-col items-center justify-center gap-1 text-[11px] text-ink-700">
                <Icon className="size-5 stroke-[1.5]" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
