import { PageHeader } from "@/components/composites/page-header";
import { TaxCalculator } from "@/components/india/tax-calculator";
import { PageContainer } from "@/components/shell/page-container";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Tax calculator" };
export const dynamic = "force-dynamic";

export default async function TaxCalculatorPage({ searchParams }: { searchParams: Promise<{ jurisdiction?: string; value?: string }> }) {
  await requireRole(["tenant_admin", "analyst"]);
  const sp = await searchParams;
  return (
    <PageContainer>
      <PageHeader eyebrow="India" title="Transaction tax calculator" subtitle="Stamp duty, registration, GST, TDS and capital gains for Mumbai, Maharashtra and Goa, with Dubai and Abu Dhabi for comparison. The rules engine computes every amount; the tax advisor agent explains it and proposes lawful structuring." />
      <div className="mt-8">
        <TaxCalculator defaults={{ jurisdiction: sp.jurisdiction, value: sp.value ? Number(sp.value) : undefined }} />
      </div>
    </PageContainer>
  );
}
