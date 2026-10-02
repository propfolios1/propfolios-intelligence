import { eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { UsersTable } from "@/components/composites/tables/users-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { InviteDialog } from "@/components/admin/invite-dialog";
import { clerkEnabled, requireRole, seatUsage } from "@/lib/auth";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const clientList = await db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(eq(s.clients.tenantId, user.tenantId));
  const seats = await seatUsage(user.tenantId);
  const rows = await db.select({ u: s.users, clientName: s.clients.name }).from(s.users).leftJoin(s.clients, eq(s.clients.id, s.users.clientId)).where(eq(s.users.tenantId, user.tenantId)).orderBy(s.users.role, s.users.name);
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
    </PageContainer>
  );
}
