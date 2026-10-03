import { notFound } from "next/navigation";
import { ActivityFeed } from "@/components/composites/activity-feed";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { TenantControls } from "@/components/platform/tenant-controls";
import { TenantStatus } from "@/components/platform/tenant-table";
import { Crumb } from "@/components/shell/crumb";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import { formatAed } from "@/lib/domain";
import { tenantDetail } from "@/lib/platform";
import { planById } from "@/lib/plans";
import { requirePlatformAdmin } from "@/lib/require-platform";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Tenant" };
export const dynamic = "force-dynamic";

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdmin();
  const { id } = await params;
  const d = /^[0-9a-f-]{36}$/i.test(id) ? await tenantDetail(await getDb(), id) : null;
  if (!d) notFound();
  const { tenant: t } = d;
  const plan = planById(t.plan);
  const cfg = t.configJson;
  return (
    <PageContainer>
      <Crumb segment={id} label={t.name} />
      <PageHeader
        eyebrow={`${t.slug} · since ${formatDate(t.createdAt)}`}
        title={t.name}
        subtitle={`${cfg.brand_name}${cfg.custom_domain ? ` on ${cfg.custom_domain}` : ""}. ${plan.name} plan.`}
        meta={
          <>
            <TenantStatus status={t.status} />
            <span className="flex items-center gap-2">
              <span className="size-3 rounded-xs" style={{ background: cfg.primary_color }} aria-hidden />
              <span className="size-3 rounded-xs" style={{ background: cfg.accent_color }} aria-hidden />
              <span className="num">
                {cfg.primary_color} / {cfg.accent_color}
              </span>
            </span>
            <span>{cfg.font_display}</span>
          </>
        }
      />
      <section className="mt-8 stat-row">
        <StatCard label="MRR" value={t.mrrAed ? formatAed(t.mrrAed) : "—"} note={t.subscription ? `Renews ${formatDate(t.subscription.currentPeriodEnd)}` : "No subscription"} />
        <StatCard label="Staff seats" value={`${t.staff} / ${t.seatLimit ?? "∞"}`} />
        <StatCard label="Clients and AUM" value={String(t.clients)} note={t.aumAed ? `${formatAed(t.aumAed)} under advice` : undefined} />
        <StatCard label="AI cost, 30 days" value={`$${t.aiCost30.toFixed(2)}`} note={`${t.agentRuns30} runs · ${t.mandates} mandates`} />
      </section>
      <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader eyebrow="Platform controls" title="Plan, status and features" />
          <CardContent>
            <TenantControls tenantId={t.id} plan={t.plan} status={t.status} features={cfg.features} />
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6 xl:col-span-7">
          <Card>
            <CardHeader eyebrow="People" title="Users" />
            <CardContent>
              <ul className="divide-y divide-hairline">
                {d.users.map((u) => (
                  <li key={u.id} className="flex items-center justify-between gap-3 py-2.5 text-small">
                    <span className="min-w-0">
                      <span className="block truncate text-ink-900">{u.name}</span>
                      <span className="num block truncate text-ink-500">{u.email}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3">
                      <StatusPill>{u.role.replace("_", " ")}</StatusPill>
                      <span className="w-20 text-right text-ink-500">{u.invitedAt ? "Invited" : u.lastActiveAt ? relativeTime(u.lastActiveAt.toISOString()) : "Never"}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader eyebrow="Billing" title="Subscriptions" />
            <CardContent>
              <ul className="divide-y divide-hairline">
                {d.subscriptions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2.5 text-small">
                    <span className="text-ink-900">
                      {planById(s.plan).name} <span className="num ml-2 text-ink-500">AED {s.priceAed.toLocaleString("en-US")}</span>
                    </span>
                    <span className="flex items-center gap-3 text-ink-500">
                      <span>since {formatDate(s.startedAt)}</span>
                      <StatusPill tone={s.status === "active" ? "complete" : s.status === "cancelled" ? "neutral" : "progress"}>{s.status}</StatusPill>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader eyebrow="Latest 25 events" title="Tenant audit log" />
            <CardContent>
              <ActivityFeed linkMandates={false} items={d.audit.map((a) => ({ id: a.id, actorName: a.actorName, actorType: a.actorType, action: a.action, createdAt: a.createdAt, costUsd: a.costUsd, model: a.model }))} />
            </CardContent>
          </Card>
        </div>
      </section>
    </PageContainer>
  );
}
