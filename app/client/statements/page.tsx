import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { portalServicing } from "@/lib/client/portal";
import { monthLabel } from "@/lib/client/servicing";
import { formatLocal } from "@/lib/format";

export const metadata = { title: "Statements" };
export const dynamic = "force-dynamic";

export default async function ClientStatements() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const p = await portalServicing(await getDb(), user);
  const aed = (n: number) => formatLocal(n, "AED", { compact: false });
  return (
    <PageContainer>
      <PageHeader eyebrow="Reporting" title="Statements" subtitle="Your monthly statement: rent received, costs paid and the value of each holding, issued on the first of each month." />
      <div className="mt-8 space-y-8">
        {!p?.statements.length && <EmptyState glyph="documents" headline="No statements yet" note="A statement of value, income and movements is issued on the first of each month for the month before." primary={{ label: "View portfolio", href: "/client/portfolio" }} secondary={{ label: "View reports", href: "/client/reports" }} />}
        {p?.statements.map((st) => (
          <article key={st.id} className="rounded-md border border-hairline bg-surface p-6 shadow-card">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-section text-navy-900">{monthLabel(st.period)}</h2>
              <span className="num text-small text-ink-500">Closing value {aed(st.data.closingValueAed)}</span>
            </div>
            {st.commentary && <p className="mt-3 max-w-[75ch] text-small text-ink-700">{st.commentary}</p>}
            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[["Opening value", st.data.openingValueAed], ["Closing value", st.data.closingValueAed], ["Rent received", st.data.rentReceivedAed], ["Costs", st.data.costsAed]].map(([l, v]) => (
                <div key={l as string}>
                  <dt className="eyebrow">{l as string}</dt>
                  <dd className="num mt-1 text-ink-900">{aed(v as number)}</dd>
                </div>
              ))}
            </dl>
            <SimpleTable
              className="mt-5"
              rows={st.data.holdings}
              minWidth={560}
              columns={[
                { key: "p", header: "Holding", cell: (h) => h.property },
                { key: "v", header: "Value", numeric: true, cell: (h) => aed(h.valueAed) },
                { key: "r", header: "Rent this month", numeric: true, cell: (h) => aed(h.rentAed) },
              ]}
            />
          </article>
        ))}
      </div>
    </PageContainer>
  );
}
