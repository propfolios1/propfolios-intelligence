import { and, eq, inArray } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { NriPlanner } from "@/components/india/nri-planner";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "NRI plan" };
export const dynamic = "force-dynamic";

export default async function ClientNriPage() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const db = await getDb();
  const props = await db
    .select({ id: s.properties.id, name: s.properties.name, city: s.properties.city, region: s.properties.region })
    .from(s.indiaPropertyRecords)
    .innerJoin(s.properties, eq(s.properties.id, s.indiaPropertyRecords.propertyId))
    .where(and(eq(s.indiaPropertyRecords.tenantId, user.tenantId), inArray(s.indiaPropertyRecords.state, ["MH", "GA"])))
    .orderBy(s.properties.region, s.properties.name);
  return (
    <PageContainer>
      <PageHeader eyebrow="India" title="NRI purchase and sale plan" subtitle="Each step from the UAE: accounts, power of attorney, payment channels, registration, tax deduction and repatriation, with who does what and when." />
      <div className="mt-8">
        <NriPlanner properties={props.map((p) => ({ id: p.id, name: p.name, place: p.city }))} clientId={user.role === "client" ? undefined : (user.clientId ?? undefined)} />
      </div>
    </PageContainer>
  );
}
