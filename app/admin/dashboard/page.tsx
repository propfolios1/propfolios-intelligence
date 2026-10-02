import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { ActivityFeed } from "@/components/composites/activity-feed";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole, seatUsage } from "@/lib/auth";
import { formatAed } from "@/lib/domain";
import { getTenantById } from "@/lib/tenant";
import { scope } from "@/lib/tenant-db";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const tenant = (await getTenantById(user.tenantId))!;
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [seats, [clients], [mandates], [spend], [sub], audit, [users]] = await Promise.all([
    seatUsage(user.tenantId),
    db.select({ n: sql<number>`count(*)::int`, aum: sql<number>`coalesce(sum(${s.clients.aumAed}), 0)::float` }).from(s.clients).where(scope(s.clients, user.tenantId)),
    db.select({ n: sql<number>`count(*)::int`, open: sql<number>`count(*) filter (where ${s.mandates.status} <> 'DELIVERED')::int` }).from(s.mandates).where(scope(s.mandates, user.tenantId)),
    db.select({ cost: sql<number>`coalesce(sum(${s.auditLogs.costUsd}), 0)::float`, runs: sql<number>`count(*) filter (where ${s.auditLogs.actorType} = 'agent')::int` }).from(s.auditLogs).where(scope(s.auditLogs, user.tenantId, sql`${s.auditLogs.createdAt} > ${since}`)),
    db.select().from(s.subscriptions).where(scope(s.subscriptions, user.tenantId)).orderBy(desc(s.subscriptions.startedAt)).limit(1),
    db.select().from(s.auditLogs).where(scope(s.auditLogs, user.tenantId, eq(s.auditLogs.actorType, "user"))).orderBy(desc(s.auditLogs.createdAt)).limit(10),
    db.select({ invited: sql<number>`count(*) filter (where ${s.users.invitedAt} is not null)::int` }).from(s.users).where(scope(s.users, user.tenantId)),
  ]);
  const trialDays = sub?.status === "trialing" ? Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - Date.now()) / 86_400_000)) : null;
  return (
    <PageContainer>
      <PageHeader
        eyebrow={`${tenant.name} · workspace`}
        title="Administration"
        subtitle={`${seats.plan.name} plan${trialDays !== null ? `, trial ends in ${trialDays} days` : sub ? `, renews ${formatDate(sub.currentPeriodEnd)}` : ""}. Manage people, branding, billing and governance for your firm.`}
        actions={
          <>
            <Button variant="secondary" asChild>
              <Link href="/admin/branding">Branding</Link>
            </Button>
            <Button asChild>
              <Link href="/admin/users">Invite people</Link>
            </Button>
          </>
        }
        meta={<StatusPill tone={tenant.status === "active" ? "complete" : "progress"}>{tenant.status}</StatusPill>}
      />
      <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Staff seats" value={`${seats.used} / ${seats.limit ?? "∞"}`} note={users?.invited ? `${users.invited} invitations pending` : "All accepted"} href="/admin/users" />
        <StatCard label="Clients" value={String(clients?.n ?? 0)} note={`${formatAed(clients?.aum ?? 0)} under advice`} href="/analyst/clients" />
        <StatCard label="Mandates" value={String(mandates?.n ?? 0)} note={`${mandates?.open ?? 0} in progress`} href="/analyst/mandates" />
        <StatCard label="AI usage, 30 days" value={`$${(spend?.cost ?? 0).toFixed(2)}`} note={`${spend?.runs ?? 0} agent runs, included in plan`} href="/admin/audit" />
      </section>
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader eyebrow="People" title="Recent administrative activity" actions={<Link href="/admin/audit" className="text-small text-ink-700 hover:text-ink-900">Audit log</Link>} />
          <CardContent>
            <ActivityFeed linkMandates={false} items={audit.map((a) => ({ id: a.id, actorName: a.actorName, actorType: a.actorType, action: a.action, createdAt: a.createdAt }))} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardHeader eyebrow="Workspace" title="Configuration" />
          <CardContent>
            <dl className="divide-y divide-ink-200 border-y border-ink-200 text-ui">
              {[
                ["Product name", tenant.configJson.brand_name],
                ["Plan", `${seats.plan.name}, AED ${seats.plan.priceAed.toLocaleString("en-US")} a month`],
                ["Custom domain", tenant.configJson.custom_domain ?? (seats.plan.customDomain ? "Not connected" : "White-label plan")],
                ["Display typeface", tenant.configJson.font_display],
                ["Assistant", tenant.configJson.features.assistant ? "Enabled" : "Disabled"],
                ["Client portal", tenant.configJson.features.clientPortal ? "Enabled" : "Disabled"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="text-right text-ink-900">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>
    </PageContainer>
  );
}
