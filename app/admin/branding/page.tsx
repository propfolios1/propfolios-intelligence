import { BrandingForm } from "@/components/admin/branding-form";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { requireRole } from "@/lib/auth";
import { planById } from "@/lib/plans";
import { getTenantById } from "@/lib/tenant";

export const metadata = { title: "Branding" };
export const dynamic = "force-dynamic";

export default async function BrandingPage() {
  const user = await requireRole(["tenant_admin"]);
  const tenant = (await getTenantById(user.tenantId))!;
  const plan = planById(tenant.plan);
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Branding" subtitle="Your name, colours, typography and memo house style apply to every screen your team and clients see, and to every Allocation Memo PDF." />
      <div className="mt-8">
        <BrandingForm config={tenant.configJson} canStyle={plan.id !== "starter"} canDomain={plan.customDomain} planName={plan.name} />
      </div>
    </PageContainer>
  );
}
