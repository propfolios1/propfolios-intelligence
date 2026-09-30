import { TooltipProvider } from "@/components/ui/tooltip";
import { getViewer } from "@/lib/auth";
import { clients, listMandateRows, portfolioAlerts, properties } from "@/lib/data/store";
import { relativeTime } from "@/lib/utils";
import { CommandPaletteProvider, type SearchItem } from "./command-palette";
import type { Area } from "./nav-config";
import { PageTransition } from "./page-transition";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

function searchIndex(): SearchItem[] {
  return [
    ...listMandateRows().map((m) => ({
      id: `m-${m.id}`,
      group: "Mandates" as const,
      label: m.id,
      sub: `${m.client} · ${m.property}`,
      href: `/analyst/mandates/${m.id}`,
      keywords: [m.status, m.analyst],
    })),
    ...properties.map((p) => ({
      id: `p-${p.id}`,
      group: "Properties" as const,
      label: p.name,
      sub: p.community,
      href: `/analyst/properties?focus=${p.id}`,
    })),
    ...clients.map((c) => ({
      id: `c-${c.id}`,
      group: "Clients" as const,
      label: c.name,
      sub: `${c.type} · ${c.domicile}`,
      href: `/analyst/mandates?client=${c.id}`,
    })),
    { id: "a-new", group: "Actions", label: "New mandate", href: "/analyst/mandates?new=1", keywords: ["create"] },
    { id: "a-dash", group: "Actions", label: "Go to dashboard", href: "/analyst/dashboard" },
    { id: "a-market", group: "Actions", label: "Open market dashboard", href: "/analyst/market" },
    { id: "a-dev", group: "Actions", label: "Review developer risk", href: "/analyst/developers" },
    { id: "a-assist", group: "Actions", label: "Ask the assistant", href: "/client/assistant" },
    { id: "a-portfolio", group: "Actions", label: "Client portfolio view", href: "/client/portfolio" },
    { id: "a-audit", group: "Actions", label: "Open audit log", href: "/admin/audit" },
  ];
}

export async function AppShell({ area, children }: { area: Area; children: React.ReactNode }) {
  const viewer = await getViewer(area);
  const notifications = portfolioAlerts.slice(0, 4).map((a) => ({ id: a.id, title: a.title, detail: a.detail, at: relativeTime(a.at) }));
  return (
    <TooltipProvider>
      <CommandPaletteProvider items={searchIndex()}>
        <div className="flex min-h-dvh">
          <SidebarNav area={area} viewer={viewer} />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar area={area} notifications={notifications} />
            <main className="flex-1">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
        </div>
      </CommandPaletteProvider>
    </TooltipProvider>
  );
}
