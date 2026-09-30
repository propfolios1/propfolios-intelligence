import { PageHeader } from "@/components/composites/page-header";
import { PropertiesView } from "@/components/properties/properties-view";
import { PageContainer } from "@/components/shell/page-container";
import { getDeveloper, properties } from "@/lib/data/store";

export const metadata = { title: "Properties" };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<{ focus?: string }> }) {
  const { focus } = await searchParams;
  const rows = properties.map((p) => ({
    id: p.id,
    name: p.name,
    developer: getDeveloper(p.developerId)!.name,
    region: p.region,
    community: p.community,
    market: p.market,
    assetClass: p.assetClass,
    status: p.status,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    currency: p.currency,
    lat: p.lat,
    lng: p.lng,
    grossYield: p.grossYield,
  }));
  const uae = rows.filter((r) => r.market === "UAE").length;
  return (
    <PageContainer>
      <PageHeader eyebrow="Research" title="Properties" subtitle={`${rows.length} tracked schemes. ${uae} in the UAE, ${rows.length - uae} in India.`} />
      <PropertiesView rows={rows} focusId={focus} />
    </PageContainer>
  );
}
