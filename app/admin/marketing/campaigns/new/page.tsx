import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { CampaignBuilder } from "@/components/marketing/automation";
import { MarketingTabs } from "@/components/marketing/tabs";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";
import { eq } from "drizzle-orm";

export const metadata = { title: "New campaign" };
export const dynamic = "force-dynamic";

export default async function NewCampaign() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [audiences, templates, accounts] = await Promise.all([
    db.select({ id: s.audiences.id, name: s.audiences.name, lastCount: s.audiences.lastCount }).from(s.audiences).where(scope(s.audiences, user.tenantId)).orderBy(desc(s.audiences.updatedAt)),
    db.select({ id: s.whatsappTemplates.id, name: s.whatsappTemplates.name, body: s.whatsappTemplates.body }).from(s.whatsappTemplates).where(scope(s.whatsappTemplates, user.tenantId, eq(s.whatsappTemplates.status, "approved"))),
    db.select({ network: s.socialAccounts.network }).from(s.socialAccounts).where(scope(s.socialAccounts, user.tenantId, eq(s.socialAccounts.status, "connected"))),
  ]);
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Marketing" title="New campaign" subtitle="Choose who receives it, write each step, and decide when it runs. Sequences stop for anyone who replies, closes or opts out." />
      <MarketingTabs active="/admin/marketing/campaigns/new" />
      <div className="mt-8 max-w-[1100px]">
        <CampaignBuilder audiences={audiences} templates={templates} networks={accounts.map((a) => a.network)} />
      </div>
    </PageContainer>
  );
}
