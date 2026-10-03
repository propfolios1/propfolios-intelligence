import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listInvoices } from "@/lib/commission/service";
import { portalServicing } from "@/lib/client/portal";
import { formatLocal } from "@/lib/format";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Tax documents" };
export const dynamic = "force-dynamic";

export default async function ClientTaxDocuments() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const db = await getDb();
  const p = await portalServicing(db, user);
  const paid = p ? (await listInvoices(db, user.tenantId, { clientId: p.client.id, kind: "advisory_fee" })).filter((r) => r.invoice.status === "paid") : [];
  return (
    <PageContainer>
      <PageHeader eyebrow="Tax" title="Tax documents" subtitle="Annual statements for your returns in the UAE and India, and tax invoices for fees paid. Prepared each April for the previous year; confirm with your tax adviser before filing." />
      {!p?.taxDocs.length && <EmptyState className="mt-8" glyph="documents" headline="No tax documents yet." />}
      {p?.taxDocs.map((d) => (
        <Section key={d.id} title={d.title} eyebrow={`${d.jurisdiction} · ${d.year}`}>
          <SimpleTable
            rows={d.data.rows}
            minWidth={520}
            columns={[
              { key: "l", header: "Item", cell: (r) => r.label },
              { key: "a", header: "Amount", numeric: true, cell: (r) => formatLocal(r.amount, r.currency, { compact: false }) },
            ]}
          />
          <ul className="mt-3 list-disc space-y-1 pl-5 text-small text-ink-700">
            {d.data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </Section>
      ))}
      {paid.length > 0 && (
        <Section title="Tax invoices for fees paid">
          <SimpleTable
            rows={paid}
            minWidth={560}
            columns={[
              { key: "n", header: "Invoice", cell: (r) => <span className="num">{r.invoice.number}</span> },
              { key: "d", header: "Paid", cell: (r) => (r.invoice.paidAt ? formatDate(r.invoice.paidAt) : "None") },
              { key: "t", header: "Tax", cell: (r) => <Flag tone="neutral">{`${r.invoice.tax.type} ${formatLocal(r.invoice.tax.amount, r.invoice.currency, { compact: false })}`}</Flag> },
              { key: "a", header: "Total", numeric: true, cell: (r) => formatLocal(r.invoice.total, r.invoice.currency, { compact: false }) },
            ]}
          />
        </Section>
      )}
    </PageContainer>
  );
}
