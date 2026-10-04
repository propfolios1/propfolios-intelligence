import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { CopyField, ScimTokens } from "@/components/enterprise/enterprise";
import { EnterpriseTabs, PlanNote } from "@/components/enterprise/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "SCIM provisioning" };
export const dynamic = "force-dynamic";

export default async function ScimPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [[t], tokens, events, managed, deactivated] = await Promise.all([
    db.select({ plan: s.tenants.plan }).from(s.tenants).where(eq(s.tenants.id, user.tenantId)),
    db.select().from(s.scimTokens).where(scope(s.scimTokens, user.tenantId)).orderBy(desc(s.scimTokens.createdAt)),
    db.select().from(s.auditLogs).where(scope(s.auditLogs, user.tenantId, inArray(s.auditLogs.entityType, ["user"]))).orderBy(desc(s.auditLogs.createdAt)).limit(200),
    db.select({ id: s.users.id }).from(s.users).where(scope(s.users, user.tenantId, isNotNull(s.users.scimExternalId))),
    db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.tenantId, user.tenantId), isNotNull(s.users.deactivatedAt))),
  ]);
  const scimEvents = events.filter((e) => e.actorName.startsWith("SCIM:")).slice(0, 15);
  const base = `${(process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nakhla.ai").replace(/\/$/, "")}/api/scim/v2`;
  const enterprise = t!.plan === "enterprise" || t!.plan === "white_label";
  return (
    <PageContainer>
      <PageHeader eyebrow="Enterprise" title="SCIM provisioning" subtitle="Your identity provider creates, updates and deactivates staff accounts automatically. Leavers lose access the moment they are removed from the application." />
      <EnterpriseTabs active="/admin/scim" />
      <PlanNote plan={t!.plan} feature="SCIM provisioning" />
      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[
          ["Provisioned users", managed.length],
          ["Deactivated accounts", deactivated.length],
          ["Active tokens", tokens.filter((x) => !x.revokedAt).length],
        ].map(([l, v]) => (
          <div key={l} className="rounded-md border border-hairline bg-surface p-4">
            <dt className="eyebrow">{l}</dt>
            <dd className="num mt-2 text-[28px] leading-none text-navy-900">{v}</dd>
          </div>
        ))}
      </dl>
      <Section title="Connection" description="Enter these in the provisioning settings of the Nakhla application in Okta, Microsoft Entra ID, OneLogin or JumpCloud.">
        <div className="grid gap-4 rounded-md border border-hairline bg-surface p-5 md:grid-cols-2">
          <CopyField label="SCIM base URL" value={base} />
          <CopyField label="Unique identifier field" value="userName (email address)" />
          <div className="md:col-span-2">
            <div className="eyebrow">Supported</div>
            <p className="mt-2 text-small text-ink-700">Create, update and deactivate users (POST, PUT, PATCH, DELETE on /Users); filtering by userName, externalId and email; roles by the <code className="num">roles</code> attribute (<code className="num">tenant_admin</code>, <code className="num">analyst</code> or a custom role key) or by group names mapped on the Roles tab. Deleting a user deactivates the account and keeps its history. Group push and bulk operations are not supported.</p>
          </div>
        </div>
      </Section>
      <Section title="Tokens" description="The identity provider authenticates with a bearer token. Create one per provider and revoke it if it is exposed.">
        <ScimTokens disabled={!enterprise} tokens={tokens.map((x) => ({ id: x.id, name: x.name, prefix: x.prefix, createdBy: x.createdBy, lastUsedAt: x.lastUsedAt?.toISOString() ?? null, requests: x.requests, revokedAt: x.revokedAt?.toISOString() ?? null, createdAt: x.createdAt.toISOString() }))} />
      </Section>
      <Section title="Recent provisioning">
        <ul className="divide-y divide-hairline rounded-md border border-hairline bg-surface">
          {!scimEvents.length && <li className="px-4 py-6 text-small text-ink-500">No provisioning events yet.</li>}
          {scimEvents.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-small">
              <span className="text-ink-900">{e.action}</span>
              <span className="text-ink-500">
                {e.actorName.replace("SCIM: ", "")} · <RelativeTime iso={e.createdAt.toISOString()} />
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </PageContainer>
  );
}
