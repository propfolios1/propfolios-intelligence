import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { UsersTable } from "@/components/tables/users-table";
import { Button } from "@/components/ui/button";
import { users } from "@/lib/data/store";

export const metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <PageContainer dense>
      <PageHeader eyebrow="Admin" title="Users" actions={<Button size="sm">Invite user</Button>} />
      <div className="mt-8">
        <UsersTable rows={users} />
      </div>
    </PageContainer>
  );
}
