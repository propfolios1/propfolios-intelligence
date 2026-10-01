import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole, type CurrentUser, type Role } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/domain";
import { listMandates } from "@/lib/queries";
import { relativeTime } from "@/lib/utils";
import { CommandPaletteProvider, type SearchItem } from "./command-palette";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { NAV, type Area } from "./nav-config";
import { PageTransition } from "./page-transition";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";

const AREA_ROLES: Record<Area, Role[]> = { analyst: ["admin", "analyst"], client: ["admin", "analyst", "client"], admin: ["admin"] };

async function searchIndex(user: CurrentUser, area: Area): Promise<SearchItem[]> {
  const db = await getDb();
  const nav: SearchItem[] = NAV[area].flatMap((sec) => sec.items.map((i) => ({ id: `nav-${i.href}`, group: "Actions" as const, label: i.label, href: i.href })));
  if (user.role === "client" || area === "client") {
    const props = await db.select({ slug: s.properties.slug, name: s.properties.name, community: s.properties.community }).from(s.properties);
    return [...nav, ...props.map((p) => ({ id: `p-${p.slug}`, group: "Properties" as const, label: p.name, sub: p.community, href: `/client/opportunities?q=${encodeURIComponent(p.name)}` }))];
  }
  const [mandates, props, clients] = await Promise.all([
    listMandates(db, user),
    db.select({ slug: s.properties.slug, name: s.properties.name, community: s.properties.community }).from(s.properties),
    db.select({ id: s.clients.id, name: s.clients.name, type: s.clients.type, residency: s.clients.residency }).from(s.clients).where(eq(s.clients.tenantId, user.tenantId)),
  ]);
  return [
    { id: "a-new", group: "Actions", label: "Create Mandate", href: "/analyst/mandates/new", keywords: ["new", "create"] },
    ...nav,
    ...mandates.map((m) => ({ id: `m-${m.id}`, group: "Mandates" as const, label: m.reference, sub: `${m.title} · ${m.clientName} · ${STAGE_LABEL[m.status]}`, href: `/analyst/mandates/${m.id}`, keywords: [m.propertyName] })),
    ...props.map((p) => ({ id: `p-${p.slug}`, group: "Properties" as const, label: p.name, sub: p.community, href: `/analyst/properties/${p.slug}` })),
    ...clients.map((c) => ({ id: `c-${c.id}`, group: "Clients" as const, label: c.name, sub: `${c.type} · ${c.residency}`, href: `/analyst/clients/${c.id}` })),
    ...(user.role === "admin" ? NAV.admin[0]!.items.map((i) => ({ id: `adm-${i.href}`, group: "Actions" as const, label: i.label, sub: "Administration", href: i.href })) : []),
  ];
}

async function notifications(user: CurrentUser, area: Area) {
  const db = await getDb();
  const clientOnly = area === "client" && user.clientId;
  const rows = await db
    .select({ a: s.alerts, clientName: s.clients.name })
    .from(s.alerts)
    .innerJoin(s.clients, eq(s.clients.id, s.alerts.clientId))
    .where(and(eq(s.alerts.tenantId, user.tenantId), eq(s.alerts.acknowledged, false), clientOnly ? eq(s.alerts.clientId, user.clientId!) : undefined))
    .orderBy(desc(s.alerts.createdAt))
    .limit(8);
  return rows.map((r) => ({ id: r.a.id, title: r.a.title, detail: area === "client" ? r.a.detail : `${r.clientName}. ${r.a.detail}`, at: relativeTime(r.a.createdAt.toISOString()), severity: r.a.severity }));
}

export async function AppShell({ area, children }: { area: Area; children: React.ReactNode }) {
  const user = await requireRole(AREA_ROLES[area]);
  const [items, alerts] = await Promise.all([searchIndex(user, area), notifications(user, area)]);
  let previewing: string | null = null;
  if (area === "client" && user.role !== "client" && user.clientId) {
    const db = await getDb();
    const [c] = await db.select({ name: s.clients.name }).from(s.clients).where(eq(s.clients.id, user.clientId));
    previewing = c?.name ?? null;
  }
  return (
    <CommandPaletteProvider items={items}>
      <a href="#main" className="sr-only z-50 rounded-sm bg-navy-900 px-3 py-2 text-surface focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <SidebarNav area={area} viewer={{ name: user.name, role: user.title ?? user.role, email: user.email, userRole: user.role, demo: user.demo }} />
        <div className="flex min-w-0 flex-1 flex-col">
          {previewing && (
            <div className="border-b border-gold-100 bg-gold-100/60 px-6 py-2 text-small text-ink-700 md:px-12 xl:px-20" data-no-print>
              Previewing the client portal as <span className="font-medium text-ink-900">{previewing}</span>. Choose another client from Clients.
            </div>
          )}
          <TopBar area={area} notifications={alerts} />
          <main id="main" className="flex-1">
            <PageTransition area={area}>{children}</PageTransition>
          </main>
        </div>
      </div>
      <KeyboardShortcuts area={area} />
    </CommandPaletteProvider>
  );
}
