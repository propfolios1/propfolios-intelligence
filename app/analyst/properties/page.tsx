import { PageHeader } from "@/components/composites/page-header";
import { PropertiesView } from "@/components/properties/properties-view";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listProperties } from "@/lib/queries";

export const metadata = { title: "Properties" };
export const dynamic = "force-dynamic";

export default async function PropertiesPage() {
  await requireRole(["admin", "analyst"]);
  const rows = await listProperties(await getDb());
  const uae = rows.filter((r) => r.market === "UAE").length;
  return (
    <PageContainer>
      <PageHeader eyebrow="Research" title="Properties" subtitle={`${rows.length} tracked projects: ${uae} in the UAE and ${rows.length - uae} in India.`} />
      <PropertiesView rows={rows} />
    </PageContainer>
  );
}
