import { count, eq } from "drizzle-orm";
import { FederationConsent, InsightSettingsForm } from "@/components/admin/intelligence-settings";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { tenantContribution } from "@/lib/federation";
import { DEFAULT_INSIGHT_CONFIG } from "@/lib/insights";
import { getTenantById } from "@/lib/tenant";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Intelligence" };
export const dynamic = "force-dynamic";

export default async function InsightsConfig() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [tenant, contributed, [delivered]] = await Promise.all([getTenantById(user.tenantId), tenantContribution(db, user.tenantId), db.select({ n: count() }).from(s.mandates).where(scope(s.mandates, user.tenantId, eq(s.mandates.status, "DELIVERED")))]);
  const cfg = tenant!.configJson;
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Intelligence" subtitle="How the platform's proactive layers work for your firm: what the insight agent raises, how rent reminders are worded, and whether your delivered mandates strengthen the federation." />
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <InsightSettingsForm config={{ ...DEFAULT_INSIGHT_CONFIG, ...(cfg.insights ?? {}) }} payments={cfg.payments ?? { link: null, instructions: null }} />
        </div>
        <div className="xl:col-span-5">
          <FederationConsent consent={tenant!.consentFederation} contributed={contributed} delivered={delivered?.n ?? 0} />
        </div>
      </div>
    </PageContainer>
  );
}
