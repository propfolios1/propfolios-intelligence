import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { UsersTable } from "@/components/composites/tables/users-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { clerkEnabled, requireRole } from "@/lib/auth";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requireRole(["admin"]);
  const db = await getDb();
  const clientList = await db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(eq(s.clients.tenantId, user.tenantId));
  const rows = await db.select({ u: s.users, clientName: s.clients.name }).from(s.users).leftJoin(s.clients, eq(s.clients.id, s.users.clientId)).where(eq(s.users.tenantId, user.tenantId)).orderBy(s.users.role, s.users.name);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Users"
        subtitle={
          clerkEnabled
            ? `${rows.length} accounts. People sign up through Clerk; the first account becomes administrator, @propfolios.ae addresses become analysts, and clients who sign up with an email the firm already holds are linked automatically. Link any other client account from the row menu.`
            : `${rows.length} accounts. Clerk is not configured, so the workspace runs in demonstration mode with persona switching from the account menu.`
        }
      />
      <div className="mt-8">
        <UsersTable
          selfId={user.id}
          clients={clientList}
          rows={rows.map(({ u, clientName }) => ({ id: u.id, name: u.name, email: u.email, title: u.title, role: u.role, clientId: u.clientId, clientName, lastActiveAt: u.lastActiveAt?.toISOString() ?? null, linked: Boolean(u.clerkUserId) }))}
        />
      </div>
    </PageContainer>
  );
}
