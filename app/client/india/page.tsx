import Link from "next/link";
import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { TaxCalculator } from "@/components/india/tax-calculator";
import { Flag, ReraStatus } from "@/components/os/badges";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatInr } from "@/lib/format";
import { clientIndiaHoldings } from "@/lib/india/service";
import { INR_PER_AED } from "@/db/seed-data";

export const metadata = { title: "India" };
export const dynamic = "force-dynamic";

export default async function ClientIndiaPage() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const rows = user.clientId ? await clientIndiaHoldings(await getDb(), user.tenantId, user.clientId) : [];
  return (
    <PageContainer>
      <PageHeader eyebrow="India" title="Your India holdings" subtitle="Regulatory standing of each Indian property and a calculator for acquisition costs in Mumbai and Goa. Figures are computed from dated rates; your advisor confirms them before any transaction." actions={<Link href="/client/nri" className="text-small text-navy-900 underline decoration-ink-200 underline-offset-4">NRI purchase and sale plan</Link>} />
      <Section title="Holdings">
        {rows.length === 0 ? (
          <EmptyState glyph="opportunities" headline="No Indian holdings on record." note="Your advisor can model an Indian acquisition with the calculator below." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {rows.map((r) => (
              <article key={r.portfolio.id} className="rounded-md border border-hairline bg-surface p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="eyebrow">{r.property.city}</div>
                    <div className="mt-2 font-display text-section text-navy-900">{r.property.name}</div>
                    <div className="mt-1 text-small text-ink-700">{r.portfolio.unitLabel}</div>
                  </div>
                  {r.record ? <ReraStatus status={r.record.reraStatus} /> : <Flag tone="neutral">{r.property.region}</Flag>}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-small">
                  <div>
                    <dt className="text-ink-500">Current value</dt>
                    <dd className="num text-ink-900">{formatInr(r.portfolio.currentValueAed * INR_PER_AED)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-500">Registration</dt>
                    <dd className="num text-ink-900">{r.record?.reraNumber ?? r.property.reraNumber}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </Section>
      <Section title="Acquisition cost calculator" description="Stamp duty, registration and taxes for a purchase in Mumbai or Goa.">
        <TaxCalculator compact />
      </Section>
    </PageContainer>
  );
}
