import { OnboardingWizard } from "@/components/marketing/onboarding-wizard";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { requirePlatformAdmin } from "@/lib/require-platform";

export const metadata = { title: "Create tenant" };
export const dynamic = "force-dynamic";

export default async function NewTenantPage() {
  await requirePlatformAdmin();
  return (
    <PageContainer>
      <PageHeader eyebrow="Nakhla platform" title="Create tenant" subtitle="Provision a workspace for a firm. Its administrator receives an invitation and becomes the first tenant administrator; the workspace starts on a 14-day trial." />
      <div className="mt-8">
        <OnboardingWizard askAdmin defaultName="" defaultEmail="" defaultPlan="professional" endpoint="/api/platform/tenants" submitLabel="Create tenant" />
      </div>
    </PageContainer>
  );
}
