import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { InvoiceDocument } from "@/components/commission/invoice-document";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listInvoices } from "@/lib/commission/service";

export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";

export default async function ClientInvoices() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const db = await getDb();
  const rows = user.clientId ? await listInvoices(db, user.tenantId, { clientId: user.clientId, kind: "advisory_fee" }) : [];
  const [t] = await db.query.tenants.findMany({ where: (x, { eq }) => eq(x.id, user.tenantId), columns: { name: true } });
  return (
    <PageContainer>
      <PageHeader eyebrow="Account" title="Invoices" subtitle="Advisory fees invoiced to you, with the tax shown. Transfer quoting the invoice number; your adviser confirms receipt." />
      <div className="mt-4 space-y-2">
        {rows.length === 0 && <EmptyState glyph="documents" headline="No invoices" note="Advisory fees are invoiced when a transaction completes, with VAT or GST shown separately. Each invoice appears here with its payment status." primary={{ label: "View transactions", href: "/client/deals" }} secondary={{ label: "View tax documents", href: "/client/tax-documents" }} />}
        {rows.map((r) => (
          <InvoiceDocument key={r.invoice.id} invoice={r.invoice} firm={t?.name ?? ""} dealReference={r.deal} />
        ))}
      </div>
    </PageContainer>
  );
}
