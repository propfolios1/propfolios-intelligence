import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { TenantTable } from "@/components/platform/tenant-table";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { listTenants } from "@/lib/platform";
import { tenantRows } from "@/lib/platform-serialize";
import { requirePlatformAdmin } from "@/lib/require-platform";

export const metadata = { title: "Tenants" };
export const dynamic = "force-dynamic";

export default async function TenantsPage() {
  await requirePlatformAdmin();
  const tenants = await listTenants(await getDb());
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Nakhla platform"
        title="Tenants"
        subtitle={`${tenants.length} workspaces. Open a tenant to change its plan, feature flags or status, or to view it as its administrator.`}
        actions={
          <Button asChild>
            <Link href="/platform/tenants/new">Create tenant</Link>
          </Button>
        }
      />
      <div className="mt-8">
        <TenantTable rows={tenantRows(tenants)} />
      </div>
    </PageContainer>
  );
}
