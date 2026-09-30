import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { PropertiesView } from "@/components/properties/properties-view";
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
    hue: p.hue,
    grossYield: p.grossYield,
  }));
  return (
    <PageContainer>
      <PageHeader eyebrow="Research" title="Properties" subtitle="Tracked schemes across the UAE and India, with pricing, status and developer." />
      <PropertiesView rows={rows} focusId={focus} />
    </PageContainer>
  );
}
