import { and, desc, eq, isNull } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { notFound, redirect } from "next/navigation";
import { requireRole, type CurrentUser, type Role } from "@/lib/auth";
import { tenantFeatures } from "@/lib/features";
import { EmptyState } from "@/components/composites/empty-state";
import { STAGE_LABEL } from "@/lib/domain";
import { listMandates } from "@/lib/queries";
import { relativeTime } from "@/lib/utils";
import { CommandPaletteProvider, type SearchItem } from "./command-palette";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { navFor, type Area } from "./nav-config";
import { PageTransition } from "./page-transition";
import { SidebarNav } from "./sidebar-nav";
import { TopBar } from "./top-bar";
import { TrialBanner } from "@/components/trial/trial-banner";

const AREA_ROLES: Record<Area, Role[]> = { analyst: ["tenant_admin", "analyst"], client: ["tenant_admin", "analyst", "client"], admin: ["tenant_admin"], platform: ["platform_admin", "tenant_admin"] };

async function searchIndex(user: CurrentUser, area: Area): Promise<SearchItem[]> {
  const db = await getDb();
  const nav: SearchItem[] = navFor(area).flatMap((sec) => sec.items.map((i) => ({ id: `nav-${i.href}`, group: "Actions" as const, label: `Go to ${i.label.toLowerCase()}`, href: i.href, keywords: [i.label] })));
  if (area === "platform") {
    const all = await db.select({ id: s.tenants.id, name: s.tenants.name, slug: s.tenants.slug, plan: s.tenants.plan }).from(s.tenants);
    return [...nav, { id: "a-new-tenant", group: "Actions", label: "Create tenant", href: "/platform/tenants/new" }, ...all.map((t) => ({ id: `t-${t.id}`, group: "Clients" as const, label: t.name, sub: `${t.slug} · ${t.plan.replace("_", "-")}`, href: `/platform/tenants/${t.id}` }))];
  }
  if (user.role === "client" || area === "client") {
    const props = await db.select({ slug: s.properties.slug, name: s.properties.name, community: s.properties.community }).from(s.properties).where(eq(s.properties.tenantId, user.tenantId));
    return [...nav, ...props.map((p) => ({ id: `p-${p.slug}`, group: "Properties" as const, label: p.name, sub: p.community, href: `/client/opportunities?q=${encodeURIComponent(p.name)}` }))];
  }
  const [mandates, props, clients, deals, developers, memos, documents] = await Promise.all([
    listMandates(db, user),
    db.select({ slug: s.properties.slug, name: s.properties.name, community: s.properties.community }).from(s.properties).where(eq(s.properties.tenantId, user.tenantId)),
    db.select({ id: s.clients.id, name: s.clients.name, type: s.clients.type, residency: s.clients.residency }).from(s.clients).where(eq(s.clients.tenantId, user.tenantId)),
    db.select({ id: s.deals.id, reference: s.deals.reference, title: s.deals.title, stage: s.deals.stage }).from(s.deals).where(eq(s.deals.tenantId, user.tenantId)).orderBy(desc(s.deals.createdAt)).limit(60),
    db.select({ name: s.developers.name, market: s.developers.market }).from(s.developers).where(eq(s.developers.tenantId, user.tenantId)),
    db.select({ id: s.memos.id, title: s.memos.title, status: s.memos.status }).from(s.memos).where(eq(s.memos.tenantId, user.tenantId)).orderBy(desc(s.memos.createdAt)).limit(40),
    db.select({ id: s.documents.id, title: s.documents.title, type: s.documents.type, mandateId: s.documents.mandateId }).from(s.documents).where(eq(s.documents.tenantId, user.tenantId)).orderBy(desc(s.documents.createdAt)).limit(60),
  ]);
  return [
    { id: "a-new", group: "Actions", label: "Create mandate", href: "/analyst/mandates/new", keywords: ["new", "create"] },
    { id: "a-new-deal", group: "Actions", label: "Open deal", href: "/analyst/deals", keywords: ["new", "create", "deal"] },
    ...nav,
    ...mandates.map((m) => ({ id: `m-${m.id}`, group: "Mandates" as const, label: m.reference, sub: `${m.title} · ${m.clientName} · ${STAGE_LABEL[m.status]}`, href: `/analyst/mandates/${m.id}`, keywords: [m.propertyName] })),
    ...deals.map((d) => ({ id: `d-${d.id}`, group: "Deals" as const, label: d.reference, sub: `${d.title} · ${d.stage.replace(/_/g, " ")}`, href: `/analyst/deals/${d.id}` })),
    ...clients.map((c) => ({ id: `c-${c.id}`, group: "Clients" as const, label: c.name, sub: `${c.type} · ${c.residency}`, href: `/analyst/clients/${c.id}` })),
    ...props.map((p) => ({ id: `p-${p.slug}`, group: "Properties" as const, label: p.name, sub: p.community, href: `/analyst/properties/${p.slug}` })),
    ...developers.map((d) => ({ id: `v-${d.name}`, group: "Developers" as const, label: d.name, sub: d.market, href: "/analyst/developers" })),
    ...memos.map((m) => ({ id: `memo-${m.id}`, group: "Memos" as const, label: m.title, sub: m.status.replace(/_/g, " "), href: `/analyst/memos/${m.id}` })),
    ...documents.map((d) => ({ id: `doc-${d.id}`, group: "Documents" as const, label: d.title, sub: d.type.replace(/_/g, " "), href: d.mandateId ? `/analyst/mandates/${d.mandateId}?tab=documents` : "/client/documents" })),
    ...(user.role === "tenant_admin" ? navFor("admin").flatMap((sec) => sec.items).map((i) => ({ id: `adm-${i.href}`, group: "Actions" as const, label: i.label, sub: "Administration", href: i.href })) : []),
  ];
}

async function notifications(user: CurrentUser, area: Area) {
  if (area === "platform") return [];
  const db = await getDb();
  const own = await db
    .select()
    .from(s.notifications)
    .where(and(eq(s.notifications.tenantId, user.tenantId), eq(s.notifications.userId, user.id), isNull(s.notifications.readAt)))
    .orderBy(desc(s.notifications.createdAt))
    .limit(6);
  const mine = own.map((n) => ({ id: n.id, title: n.title, detail: n.body, at: relativeTime(n.createdAt.toISOString()), severity: n.priority === "high" ? "HIGH" : undefined, href: n.href ?? undefined }));
  const clientOnly = area === "client" && user.clientId;
  const rows = await db
    .select({ a: s.alerts, clientName: s.clients.name })
    .from(s.alerts)
    .innerJoin(s.clients, eq(s.clients.id, s.alerts.clientId))
    .where(and(eq(s.alerts.tenantId, user.tenantId), eq(s.alerts.acknowledged, false), clientOnly ? eq(s.alerts.clientId, user.clientId!) : undefined))
    .orderBy(desc(s.alerts.createdAt))
    .limit(8);
  return [...mine, ...rows.map((r) => ({ id: r.a.id, title: r.a.title, detail: area === "client" ? r.a.detail : `${r.clientName}. ${r.a.detail}`, at: relativeTime(r.a.createdAt.toISOString()), severity: r.a.severity }))];
}

export async function AppShell({ area, children }: { area: Area; children: React.ReactNode }) {
  const user = await requireRole(AREA_ROLES[area]);
  if (area === "platform" && !user.platformAdmin) notFound();
  if (area !== "platform" && user.role === "platform_admin") redirect("/platform/dashboard");
  if (area === "client" && user.role === "client" && !(await tenantFeatures(user.tenantId)).clientPortal) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[960px] items-center px-6">
        <EmptyState glyph="documents" headline="The client portal is not enabled for your firm" note="Statements and memos continue to reach you from your relationship manager by email. Ask them to enable portal access." primary={{ label: "Return to sign-in", href: "/sign-in" }} secondary={{ label: "About Nakhla", href: "/" }} />
      </div>
    );
  }
  const [items, alerts, t] = await Promise.all([searchIndex(user, area), notifications(user, area), getTranslations("shell")]);
  let previewing: string | null = null;
  if (area === "client" && user.role !== "client" && user.clientId) {
    const db = await getDb();
    const [c] = await db.select({ name: s.clients.name }).from(s.clients).where(eq(s.clients.id, user.clientId));
    previewing = c?.name ?? null;
  }
  return (
    <CommandPaletteProvider items={items}>
      <a href="#main" className="sr-only z-50 rounded-sm bg-navy-900 px-3 py-2 text-surface focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        {t("skip")}
      </a>
      <div className="flex min-h-dvh">
        <SidebarNav area={area} viewer={{ name: user.name, role: user.impersonating ? `Viewing ${user.tenantSlug} as administrator` : (user.title ?? user.role.replace("_", " ")), email: user.email, userRole: user.role, platformAdmin: user.platformAdmin, impersonating: user.impersonating, demo: user.demo }} />
        <div className="flex min-w-0 flex-1 flex-col">
          {user.impersonating && area !== "platform" && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-900 bg-navy-900 px-6 py-2 text-small text-surface md:px-12 xl:px-20" data-no-print role="status">
              <span>
                Platform view of <span className="font-medium">{user.tenantSlug}</span>. Actions are recorded in this tenant&apos;s audit log under your name.
              </span>
              <a href="/api/platform/impersonate?exit=1" className="underline decoration-surface/40 underline-offset-4 hover:decoration-surface">
                Return to platform
              </a>
            </div>
          )}
          {previewing && (
            <div className="border-b border-hairline bg-ink-50 px-6 py-2 text-small text-ink-700 md:px-12 xl:px-20" data-no-print>
              Previewing the client portal as <span className="font-medium text-ink-900">{previewing}</span>. Choose another client from Clients.
            </div>
          )}
          {area !== "platform" && <TrialBanner tenantId={user.tenantId} admin={user.role === "tenant_admin"} />}
          <TopBar area={area} notifications={alerts} viewerName={user.name} />
          <main id="main" className="flex-1">
            <PageTransition area={area}>{children}</PageTransition>
          </main>
        </div>
      </div>
      <KeyboardShortcuts area={area} />
    </CommandPaletteProvider>
  );
}
