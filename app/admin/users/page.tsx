import { PageHeader } from "@/components/composites/page-header";
import { UsersTable } from "@/components/composites/tables/users-table";
import { Button } from "@/components/primitives/button";
import { PageContainer } from "@/components/shell/page-container";
import { users } from "@/lib/data/store";

export const metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <PageContainer className="pt-10 md:pt-12">
      <PageHeader title="Users" subtitle={`${users.length} accounts.`} actions={<Button size="sm">Invite</Button>} />
      <div className="mt-8">
        <UsersTable rows={users} />
      </div>
    </PageContainer>
  );
}
