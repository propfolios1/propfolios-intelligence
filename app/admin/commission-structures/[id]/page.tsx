import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { CommissionCalculator } from "@/components/commission/calculator";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { configFromStructure } from "@/lib/commission/calc-service";
import { MARKET_TAX } from "@/lib/commission/calculator";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Commission structure" };
export const dynamic = "force-dynamic";

export default async function CommissionStructure({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [st] = await db.select().from(s.commissionStructures).where(scope(s.commissionStructures, user.tenantId, eq(s.commissionStructures.id, id)));
  if (!st) notFound();
  const currency = st.calc?.currency ?? st.currency ?? "AED";
  const people = await db.select({ id: s.users.id, name: s.users.name }).from(s.users).where(scope(s.users, user.tenantId)).orderBy(s.users.name);
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Link href="/admin/commission-structures">Commission structures</Link>}
        title={st.name}
        subtitle="Edit the structure and watch a sample deal recompute. Saving keeps the deal calculator, closing and invoicing on the same definition."
        actions={
          <Button asChild variant="secondary">
            <Link href="/admin/commissions/structures">Matching rules</Link>
          </Button>
        }
      />
      <div className="mt-8">
        <CommissionCalculator mode="structure" structureId={st.id} structureName={st.name} currency={currency} initialPrice="2500000" initialConfig={configFromStructure(st, currency, MARKET_TAX[currency] ?? MARKET_TAX.AED!)} people={people} />
      </div>
    </PageContainer>
  );
}
