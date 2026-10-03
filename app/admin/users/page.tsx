import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { UsersTable } from "@/components/composites/tables/users-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { InviteDialog } from "@/components/admin/invite-dialog";
import { AccessRoleSelect, PermissionSuggester } from "@/components/fabric/access-roles";
import { Section } from "@/components/os/simple-table";
import { clerkEnabled, requireRole, seatUsage } from "@/lib/auth";
import { ACCESS_ROLES, BASE_ROLE, DEFAULT_ACCESS, MATRIX, PERMISSIONS, ROLE_LABEL, type AccessRole, type Permission } from "@/lib/rbac/permissions";
import { cn } from "@/lib/utils";

const FIRM_ROLES = ACCESS_ROLES.filter((r) => !r.startsWith("platform"));

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const clientList = await db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(eq(s.clients.tenantId, user.tenantId));
  const seats = await seatUsage(user.tenantId);
  const rows = await db.select({ u: s.users, clientName: s.clients.name }).from(s.users).leftJoin(s.clients, eq(s.clients.id, s.users.clientId)).where(eq(s.users.tenantId, user.tenantId)).orderBy(s.users.role, s.users.name);
  const staffAndClients = rows.filter(({ u }) => u.role !== "platform_admin");
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        subtitle={
          clerkEnabled
            ? `${seats.used} of ${seats.limit ?? "unlimited"} staff seats on the ${seats.plan.name} plan. Invitations are sent by email through Clerk; people join this workspace when they sign up with the invited address.`
            : `${seats.used} of ${seats.limit ?? "unlimited"} staff seats on the ${seats.plan.name} plan. Clerk is not configured, so invitations are recorded and people can be selected as demonstration identities.`
        }
        actions={<InviteDialog clients={clientList} seats={seats} />}
      />
      <div className="mt-8">
        <UsersTable
          selfId={user.id}
          clients={clientList}
          rows={rows.filter(({ u }) => u.role !== "platform_admin").map(({ u, clientName }) => ({ id: u.id, name: u.name, email: u.email, title: u.title, role: u.role as "tenant_admin" | "analyst" | "client", clientId: u.clientId, clientName, lastActiveAt: u.lastActiveAt?.toISOString() ?? null, linked: Boolean(u.clerkUserId), invited: Boolean(u.invitedAt) }))}
        />
      </div>

      <Section title="Access roles" description="Each person's base role decides which workspace they use; the access role inside it decides what they may do. Changes take effect on the next request and are recorded in the audit log.">
        <div className="overflow-x-auto rounded-md border border-ink-200 bg-surface shadow-card">
          <table className="w-full min-w-[720px] text-small">
            <thead className="border-b border-ink-200 bg-navy-50 text-left">
              <tr>
                {["Person", "Workspace", "Access role", "Permissions"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-axis font-medium tracking-[0.06em] text-ink-500 uppercase">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffAndClients.map(({ u }) => {
                const base = u.role as "tenant_admin" | "analyst" | "client";
                const current = (u.accessRole ?? DEFAULT_ACCESS[base]) as AccessRole;
                const options = FIRM_ROLES.filter((r) => BASE_ROLE[r] === base && (r !== "tenant_owner" || user.accessRole === "tenant_owner" || current === "tenant_owner")).map((r) => ({ value: r, label: ROLE_LABEL[r] }));
                return (
                  <tr key={u.id} className="border-t border-ink-200 first:border-t-0">
                    <td className="px-4 py-3">
                      <div className="text-ink-900">{u.name}</div>
                      <div className="text-[12px] text-ink-500">{u.title ?? u.email}</div>
                    </td>
                    <td className="px-4 py-3 text-ink-700">{base === "client" ? "Client portal" : base === "tenant_admin" ? "Administration" : "Analyst desk"}</td>
                    <td className="px-4 py-3">
                      <AccessRoleSelect userId={u.id} value={current} options={options} disabled={u.id === user.id || options.length < 2} />
                    </td>
                    <td className="num px-4 py-3 text-ink-700">{MATRIX[current].length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Permission suggester" description="Reads a person's last ninety days of audited actions, including actions they were refused, and recommends the least-privileged role that covers their work.">
        <PermissionSuggester users={staffAndClients.filter(({ u }) => u.role !== "client" && u.id !== user.id).map(({ u }) => ({ id: u.id, name: u.name }))} />
      </Section>

      <Section title="Permission matrix" description="What each firm role may do. Client roles apply inside the client portal only.">
        <div className="overflow-x-auto rounded-md border border-ink-200 bg-surface shadow-card">
          <table className="w-full min-w-[1080px] text-small">
            <thead className="border-b border-ink-200 bg-navy-50 text-left">
              <tr>
                <th className="sticky left-0 bg-navy-50 px-4 py-2.5 text-axis font-medium tracking-[0.06em] text-ink-500 uppercase">Permission</th>
                {FIRM_ROLES.map((r) => (
                  <th key={r} className="px-2 py-2.5 text-center text-axis font-medium tracking-[0.04em] text-ink-500 uppercase">
                    {ROLE_LABEL[r]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(Object.keys(PERMISSIONS) as Permission[])
                .filter((p) => !p.startsWith("platform"))
                .map((p) => (
                  <tr key={p} className="border-t border-ink-200">
                    <td className="sticky left-0 bg-surface px-4 py-2 text-ink-700">{PERMISSIONS[p]}</td>
                    {FIRM_ROLES.map((r) => (
                      <td key={r} className="px-2 py-2 text-center">
                        <span className={cn("inline-block size-2 rounded-full", MATRIX[r].includes(p) ? "bg-navy-900" : "bg-ink-200")} aria-label={MATRIX[r].includes(p) ? "Allowed" : "Not allowed"} />
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PageContainer>
  );
}
