import { and, desc, eq, gte, sql } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { ApiKeysPanel, CopyField } from "@/components/enterprise/enterprise";
import { EnterpriseTabs } from "@/components/enterprise/tabs";
import { Section } from "@/components/os/simple-table";
import { LineSeries } from "@/components/charts/series";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { KEY_SCOPES } from "@/lib/api-keys";
import { requireRole } from "@/lib/auth";
import { WEBHOOK_EVENTS, webhookView } from "@/lib/webhooks/service";
import { WebhooksPanel } from "@/components/enterprise/webhooks";

export const metadata = { title: "API" };
export const dynamic = "force-dynamic";

export default async function ApiPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const since = new Date(Date.now() - 29 * 86_400_000).toISOString().slice(0, 10);
  const [keys, usage, byDay, byRoute] = await Promise.all([
    db.select().from(s.apiKeys).where(eq(s.apiKeys.tenantId, user.tenantId)).orderBy(desc(s.apiKeys.createdAt)),
    db.select({ apiKeyId: s.apiUsage.apiKeyId, requests: sql<number>`sum(${s.apiUsage.requests})::int`, errors: sql<number>`sum(${s.apiUsage.errors})::int`, throttled: sql<number>`sum(${s.apiUsage.throttled})::int` }).from(s.apiUsage).where(and(eq(s.apiUsage.tenantId, user.tenantId), gte(s.apiUsage.day, since))).groupBy(s.apiUsage.apiKeyId),
    db.select({ day: s.apiUsage.day, requests: sql<number>`sum(${s.apiUsage.requests})::int`, throttled: sql<number>`sum(${s.apiUsage.throttled})::int` }).from(s.apiUsage).where(and(eq(s.apiUsage.tenantId, user.tenantId), gte(s.apiUsage.day, since))).groupBy(s.apiUsage.day),
    db.select({ route: s.apiUsage.route, requests: sql<number>`sum(${s.apiUsage.requests})::int`, errors: sql<number>`sum(${s.apiUsage.errors})::int` }).from(s.apiUsage).where(and(eq(s.apiUsage.tenantId, user.tenantId), gte(s.apiUsage.day, since))).groupBy(s.apiUsage.route).orderBy(desc(sql`sum(${s.apiUsage.requests})`)).limit(10),
  ]);
  const hooks = await webhookView(db, user.tenantId);
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - (29 - i) * 86_400_000).toISOString().slice(0, 10));
  const series = days.map((d) => {
    const hit = byDay.find((x) => String(x.day) === d);
    return { day: d.slice(5), requests: hit?.requests ?? 0, throttled: hit?.throttled ?? 0 };
  });
  const app = (process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nakhla.ai").replace(/\/$/, "");
  return (
    <PageContainer>
      <PageHeader eyebrow="Enterprise" title="API" subtitle="Keys for the MCP server and the inbound lead API, each with its own scopes, per-minute limit and expiry. Every call is counted by key and route." />
      <EnterpriseTabs active="/admin/api" />
      <Section title="Usage, last 30 days">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-md border border-hairline bg-surface p-4">
            <LineSeries data={series} x="day" series={[{ key: "requests", label: "Requests" }, { key: "throttled", label: "Throttled" }]} height={220} format="number" />
          </div>
          <div className="rounded-md border border-hairline bg-surface">
            <div className="eyebrow border-b border-hairline px-4 py-3">Busiest routes</div>
            <ul className="divide-y divide-hairline text-small">
              {!byRoute.length && <li className="px-4 py-4 text-ink-500">No calls in the last 30 days.</li>}
              {byRoute.map((r) => (
                <li key={r.route} className="flex justify-between gap-3 px-4 py-2">
                  <code className="num truncate text-ink-900">{r.route}</code>
                  <span className="num text-ink-700">{r.requests.toLocaleString("en-GB")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>
      <Section title="Keys" description="A key's secret is shown once. Calls over a key's limit receive HTTP 429 with a Retry-After header; expired and revoked keys receive 401.">
        <ApiKeysPanel
          scopes={Object.entries(KEY_SCOPES).map(([key, label]) => ({ key, label }))}
          keys={keys.map((k) => ({ id: k.id, name: k.name, prefix: k.prefix, scopes: k.scopes, rateLimitPerMinute: k.rateLimitPerMinute, expiresAt: k.expiresAt?.toISOString() ?? null, createdBy: k.createdBy, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, revokedAt: k.revokedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString(), usage30d: usage.find((u) => u.apiKeyId === k.id) ?? { requests: 0, errors: 0, throttled: 0 } }))}
        />
      </Section>
      <Section id="webhooks" title="Webhooks" description="Signed notifications to your systems when leads arrive, deals move and commission is paid. Verify each request with the endpoint's secret; failures are retried for about fifteen hours.">
        <WebhooksPanel
          events={Object.entries(WEBHOOK_EVENTS).map(([key, label]) => ({ key, label }))}
          endpoints={hooks.endpoints.map((e) => ({ id: e.id, url: e.url, description: e.description, events: e.events, active: e.active, consecutiveFailures: e.consecutiveFailures, lastDeliveryAt: e.lastDeliveryAt?.toISOString() ?? null, disabledReason: e.disabledReason }))}
          deliveries={hooks.deliveries.map((d) => ({ id: d.id, endpointId: d.endpointId, event: d.event, status: d.status, attempts: d.attempts, responseStatus: d.responseStatus, responseMs: d.responseMs, error: d.error, createdAt: d.createdAt.toISOString(), nextAttemptAt: d.nextAttemptAt.toISOString() }))}
        />
      </Section>
      <Section title="Endpoints">
        <div className="grid gap-4 rounded-md border border-hairline bg-surface p-5 md:grid-cols-2">
          <CopyField label="MCP server (Streamable HTTP), scope mcp" value={`${app}/api/mcp`} />
          <CopyField label="MCP tools over REST, scope mcp" value={`${app}/api/mcp/{tool}`} />
          <CopyField label="Inbound leads, scope leads:write" value={`${app}/api/leads/inbound/{source}`} />
          <CopyField label="Authentication header" value="Authorization: Bearer nk_live_…" />
        </div>
      </Section>
    </PageContainer>
  );
}
