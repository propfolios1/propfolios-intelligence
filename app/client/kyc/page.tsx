import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { ClientKyc } from "@/components/compliance/compliance";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { JURISDICTIONS, type JurisdictionCode } from "@/lib/compliance/jurisdictions";
import { complianceSettings, startKyc } from "@/lib/compliance/service";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Identity verification" };
export const dynamic = "force-dynamic";

export default async function ClientKycPage() {
  const user = await requireRole(["client"]);
  const db = await getDb();
  let [k] = user.clientId ? await db.select().from(s.kycVerifications).where(scope(s.kycVerifications, user.tenantId, eq(s.kycVerifications.clientId, user.clientId))).orderBy(desc(s.kycVerifications.createdAt)).limit(1) : [];
  if ((!k || k.status === "expired") && user.clientId) {
    const [c] = await db.select().from(s.clients).where(eq(s.clients.id, user.clientId));
    const settings = await complianceSettings(db, user.tenantId);
    k = await startKyc(db, user.tenantId, { subjectType: "client", clientId: user.clientId, name: c!.name, entityType: /family office|company/i.test(c!.type) ? "company" : "person", jurisdiction: /india|nri/i.test(c!.residency) ? "IN" : settings.jurisdictions[0]! });
  }
  const j = k ? JURISDICTIONS[k.jurisdiction as JurisdictionCode] : null;
  return (
    <PageContainer>
      <PageHeader eyebrow="Account" title="Identity verification" subtitle={`Before a property transaction, the firm is required by law to verify your identity and the source of the funds${j ? `, under ${j.law.split(" and ")[0]}` : ""}. Your documents are stored privately and seen only by the people handling your account.`} />
      <div className="mt-8 max-w-[760px]">{k ? <ClientKyc initial={k} /> : <p className="text-ui text-ink-500">Your account is not linked to a client record yet. Your adviser will set this up.</p>}</div>
    </PageContainer>
  );
}
