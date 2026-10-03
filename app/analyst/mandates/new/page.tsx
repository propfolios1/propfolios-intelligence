import { CreateMandateForm } from "@/components/composites/mandate/create-mandate-form";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listClients, listProperties } from "@/lib/queries";

export const metadata = { title: "Create mandate" };
export const dynamic = "force-dynamic";

export default async function NewMandatePage({ searchParams }: { searchParams: Promise<{ client?: string; property?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const sp = await searchParams;
  const db = await getDb();
  const [clients, properties] = await Promise.all([listClients(db, user), listProperties(db, user.tenantId)]);
  return (
    <PageContainer>
      <PageHeader eyebrow="New engagement" title="Create mandate" subtitle="The agent pipeline starts as soon as the mandate is created. Expect a draft memo in under a minute in replay mode, a few minutes with live models." />
      <CreateMandateForm
        defaultClientId={sp.client}
        defaultPropertyId={sp.property}
        clients={clients.map((c) => ({ id: c.id, name: c.name, riskProfile: c.riskProfile, residency: c.residency, markets: c.policy.markets, horizonYears: c.policy.horizonYears }))}
        properties={properties.map((p) => ({ id: p.id, name: p.name, community: p.community, city: p.city, market: p.market, status: p.status, currency: p.currency, priceMin: p.priceMin, priceMax: p.priceMax, grossYield: p.grossYield, developerName: p.developerName }))}
      />
    </PageContainer>
  );
}
