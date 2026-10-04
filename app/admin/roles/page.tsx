import { asc, ne } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { RoleAssign, RolesPanel } from "@/components/enterprise/enterprise";
import { EnterpriseTabs } from "@/components/enterprise/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { GRANTABLE, listRoles, PERMISSION_GROUPS } from "@/lib/enterprise/roles";
import { BASE_ROLE, MATRIX, PERMISSIONS, ROLE_LABEL, type AccessRole } from "@/lib/rbac/permissions";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Roles" };
export const dynamic = "force-dynamic";

const TEMPLATES: AccessRole[] = ["tenant_admin", "compliance_officer", "senior_analyst", "analyst", "junior_analyst", "client_principal", "client_delegate", "client_viewer"];

export default async function RolesPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [roles, people] = await Promise.all([listRoles(db, user.tenantId), db.select({ id: s.users.id, name: s.users.name, email: s.users.email, role: s.users.role, customRoleId: s.users.customRoleId, deactivatedAt: s.users.deactivatedAt }).from(s.users).where(scope(s.users, user.tenantId, ne(s.users.role, "platform_admin"))).orderBy(asc(s.users.role), asc(s.users.name))]);
  const catalogue = {
    groups: PERMISSION_GROUPS.map((g) => ({ label: g.label, permissions: GRANTABLE.filter((p) => g.prefixes.some((x) => p.startsWith(x))).map((p) => ({ key: p, label: PERMISSIONS[p] })) })),
    templates: TEMPLATES.map((r) => ({ key: r, label: ROLE_LABEL[r], base: BASE_ROLE[r] as "tenant_admin" | "analyst" | "client", permissions: MATRIX[r].filter((p) => !p.startsWith("platform:")) })),
  };
  const BASE = { tenant_admin: "Administrator", analyst: "Analyst", client: "Client", platform_admin: "Platform" } as const;
  return (
    <PageContainer>
      <PageHeader eyebrow="Enterprise" title="Roles" subtitle="Compose roles from the permission catalogue when the built-in roles do not match how the firm works: a leasing desk lead, an external auditor, a family office's delegate." />
      <EnterpriseTabs active="/admin/roles" />
      <Section title="Custom roles" description="A custom role replaces the permissions of the person's access role. Their base role still decides which workspace they use and what row-level security lets them read.">
        <RolesPanel roles={roles.map((r) => ({ ...r, permissions: r.permissions }))} catalogue={catalogue} />
      </Section>
      <Section title="Assignments" description="Changes take effect on the person's next request and are recorded in the audit log.">
        <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
          <table className="w-full min-w-[640px] text-small">
            <thead className="border-b border-hairline text-left">
              <tr className="eyebrow">
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">Base role</th>
                <th className="px-4 py-3 font-medium">Custom role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {people.map((p) => (
                <tr key={p.id} className={p.deactivatedAt ? "text-ink-400" : undefined}>
                  <td className="px-4 py-3">
                    <div className="text-ink-900">{p.name}</div>
                    <div className="text-[12px] text-ink-500">
                      {p.email}
                      {p.deactivatedAt ? " · deactivated" : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">{BASE[p.role]}</td>
                  <td className="px-4 py-3">{p.id === user.id ? <span className="text-ink-500">Your own role cannot be changed here</span> : <RoleAssign userId={p.id} base={p.role} value={p.customRoleId} roles={roles.map((r) => ({ id: r.id, name: r.name, baseRole: r.baseRole }))} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </PageContainer>
  );
}
