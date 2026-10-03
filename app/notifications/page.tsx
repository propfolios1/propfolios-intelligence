import { and, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { MarkRead, PreferencesForm, type Pref } from "@/components/fabric/notification-actions";
import { Flag } from "@/components/os/badges";
import { activeTab, SectionTabs } from "@/components/os/section-tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const TABS = [
  ["inbox", "Inbox"],
  ["mentions", "Mentions"],
  ["preferences", "Preferences"],
] as const;

const CATEGORY: Record<Pref["category"], { label: string; note: string; staff: boolean; email: boolean }> = {
  deals: { label: "Deals", note: "Stage changes, offers received, contracts signed", staff: true, email: false },
  commissions: { label: "Commissions", note: "Commission computed, invoice issued and paid", staff: true, email: true },
  kyc: { label: "KYC and AML", note: "Expiring identification, screening matches", staff: true, email: true },
  insights: { label: "Insights", note: "Proactive intelligence on your portfolio and pipeline", staff: false, email: false },
  mentions: { label: "Mentions", note: "A colleague wrote @your name in a note or message", staff: true, email: true },
  reports: { label: "Reports", note: "Quarterly reports and statements ready to read", staff: false, email: true },
  system: { label: "System", note: "Automations, data requests and workspace changes", staff: true, email: false },
};

export default async function Notifications({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const tab = activeTab(TABS, (await searchParams).tab);
  const db = await getDb();
  const [rows, prefs] = await Promise.all([
    db.select().from(s.notifications).where(and(eq(s.notifications.tenantId, user.tenantId), eq(s.notifications.userId, user.id))).orderBy(desc(s.notifications.createdAt)).limit(100),
    db.select().from(s.notificationPreferences).where(and(eq(s.notificationPreferences.tenantId, user.tenantId), eq(s.notificationPreferences.userId, user.id))),
  ]);
  const unread = rows.filter((r) => !r.readAt);
  const list = tab === "mentions" ? rows.filter((r) => r.category === "mentions") : rows;
  const staff = user.role !== "client";
  const pref = new Map(prefs.map((p) => [p.category, p]));
  const initial: Pref[] = (Object.keys(CATEGORY) as Pref["category"][])
    .filter((c) => staff || !CATEGORY[c].staff || c === "mentions")
    .map((c) => ({ category: c, label: CATEGORY[c].label, note: CATEGORY[c].note, inApp: pref.get(c)?.inApp ?? true, email: pref.get(c)?.email ?? CATEGORY[c].email, digest: pref.get(c)?.digest ?? "off" }));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={staff ? "Workspace" : "Client portal"}
        title="Notifications"
        subtitle="Everything addressed to you across deals, commissions, compliance and research, with control over what arrives by email and when."
        actions={<MarkRead ids="all" label="Mark all as read" variant="secondary" />}
      />
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Unread" value={String(unread.length)} />
        <StatCard label="High priority" value={String(unread.filter((r) => r.priority === "high").length)} />
        <StatCard label="Mentions" value={String(rows.filter((r) => r.category === "mentions").length)} />
        <StatCard label="Email categories" value={String(initial.filter((p) => p.email).length)} note={`of ${initial.length}`} />
      </section>
      <div className="mt-10">
        <SectionTabs base="/notifications" tabs={TABS} active={tab} label="Notification sections" />
      </div>

      {tab === "preferences" ? (
        <Section title="Delivery preferences" description="In-app notifications are always kept in this inbox. Email can arrive immediately or be gathered into a daily or weekly digest.">
          <PreferencesForm initial={initial} />
        </Section>
      ) : (
        <Section
          title={tab === "mentions" ? "Mentions" : "Inbox"}
          description={tab === "mentions" ? "Write @ followed by a colleague's name in a negotiation note or a client conversation to bring them in." : undefined}
        >
          <ul className="divide-y divide-ink-200 rounded-lg border border-ink-200 bg-surface shadow-card">
            {list.length === 0 && <li className="px-6 py-10 text-center text-small text-ink-500">{tab === "mentions" ? "Nobody has mentioned you yet." : "No notifications."}</li>}
            {list.map((n) => (
              <li key={n.id} className={"flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-start sm:justify-between " + (n.readAt ? "" : "bg-navy-50/60")}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {!n.readAt && <span className="size-1.5 shrink-0 rounded-full bg-navy-900" aria-label="Unread" />}
                    <span className="text-body font-medium text-ink-900">{n.title}</span>
                    <Flag tone={n.priority === "high" ? "error" : "neutral"}>{CATEGORY[n.category]?.label ?? n.category}</Flag>
                  </div>
                  <p className="mt-1 text-small text-ink-700">{n.body}</p>
                  <div className="mt-1 text-[12px] text-ink-500">
                    <RelativeTime iso={n.createdAt.toISOString()} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {n.href && (
                    <Link href={n.href} className="text-small text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
                      Open
                    </Link>
                  )}
                  {!n.readAt && <MarkRead ids={[n.id]} />}
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PageContainer>
  );
}
