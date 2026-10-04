import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { WhatsappTabs } from "@/components/whatsapp/tabs";
import { TemplateManager } from "@/components/whatsapp/whatsapp";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { tplDto, whatsappView } from "@/lib/whatsapp/view";

export const metadata = { title: "WhatsApp templates" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireRole(["tenant_admin"]);
  const v = await whatsappView(await getDb(), user.tenantId);
  return (
    <PageContainer>
      <PageHeader eyebrow="WhatsApp" title="Templates" subtitle="Templates open conversations outside the 24-hour window and carry every broadcast. Meta reviews each one; statuses are refreshed from the provider." />
      <WhatsappTabs active="/admin/whatsapp/templates" />
      <div className="mt-8">
        <TemplateManager templates={v.templates.map(tplDto)} />
      </div>
    </PageContainer>
  );
}
