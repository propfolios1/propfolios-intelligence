import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceButtons, RecordPayment } from "@/components/commission/invoice-actions";
import { Flag } from "@/components/os/badges";
import { RunAgent } from "@/components/os/run-agent";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { getInvoice } from "@/lib/commission/service";
import { formatLocal } from "@/lib/format";
import { formatDate } from "@/lib/utils";
import { InvoiceDocument } from "@/components/commission/invoice-document";

export const metadata = { title: "Invoice" };
export const dynamic = "force-dynamic";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { id } = await params;
  const r = /^[0-9a-f-]{36}$/i.test(id) ? await getInvoice(await getDb(), user.tenantId, id) : null;
  if (!r) notFound();
  const inv = r.invoice;
  const received = r.payments.reduce((a, p) => a + p.amount, 0);
  const receivable = inv.total - (inv.tax.tdsAmount ?? 0);
  const tax = await lastOutput(user.tenantId, "tax-advisor", id);
  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-4" data-no-print>
        <Link href="/admin/invoices" className="text-small text-ink-700 underline decoration-ink-200 underline-offset-4">
          All invoices
        </Link>
        <InvoiceButtons id={id} status={inv.status} email={inv.recipientEmail} />
      </div>
      <InvoiceDocument invoice={inv} firm={r.tenant.name} dealReference={r.deal?.reference ?? null} />
      <div data-no-print>
        <Section title="Payments" description={`${formatLocal(received, inv.currency, { compact: false })} received of ${formatLocal(receivable, inv.currency, { compact: false })} receivable${inv.tax.tdsAmount ? " (after TDS withheld by the payer)" : ""}.`}>
          <SimpleTable
            rows={r.payments}
            empty="No payments recorded."
            minWidth={620}
            columns={[
              { key: "d", header: "Received", cell: (p) => formatDate(p.receivedAt) },
              { key: "a", header: "Amount", numeric: true, cell: (p) => formatLocal(p.amount, p.currency, { compact: false }) },
              { key: "m", header: "Method", cell: (p) => p.method.replace("_", " ") },
              { key: "r", header: "Reference", cell: (p) => <span className="num">{p.reference}</span> },
              { key: "s", header: "Source", cell: (p) => <Flag tone="neutral">{p.source}</Flag> },
            ]}
          />
          {inv.status !== "paid" && inv.status !== "void" && (
            <div className="mt-4">
              <RecordPayment id={id} currency={inv.currency} outstanding={Math.max(0, receivable - received)} />
            </div>
          )}
        </Section>
        <Section title="Tax treatment" eyebrow="Agent 27 · Tax advisor">
          <RunAgent endpoint={`/api/invoices/${id}/agent`} body={{}} agentLabel="Tax advisor" initial={tax ? { output: tax.output as never, model: tax.model, costUsd: tax.costUsd, at: tax.at } : null} />
        </Section>
      </div>
    </PageContainer>
  );
}
