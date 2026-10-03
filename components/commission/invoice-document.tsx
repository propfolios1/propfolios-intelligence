import { Flag } from "@/components/os/badges";
import type * as s from "@/db/schema";
import { formatLocal } from "@/lib/format";
import { formatDate } from "@/lib/utils";

/** The invoice as the recipient sees it; prints cleanly. */
export function InvoiceDocument({ invoice: inv, firm, dealReference }: { invoice: typeof s.invoices.$inferSelect; firm: string; dealReference: string | null }) {
  const m = (n: number) => formatLocal(n, inv.currency, { compact: false });
  return (
    <article className="mt-6 rounded-md border border-hairline bg-surface p-8 shadow-card md:p-12">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="font-display text-page-sm text-navy-900">{firm}</div>
          <div className="mt-1 text-small text-ink-500">{inv.tax.type === "UAE VAT" ? "Tax invoice" : inv.tax.type === "India GST" ? "Tax invoice (GST)" : "Invoice"}</div>
        </div>
        <div className="text-right">
          <div className="num text-section text-navy-900">{inv.number}</div>
          <Flag tone={inv.status === "paid" ? "complete" : inv.status === "overdue" ? "error" : "progress"}>{inv.status.replace("_", " ")}</Flag>
        </div>
      </div>
      <dl className="mt-8 grid gap-4 text-small sm:grid-cols-3">
        <div>
          <dt className="eyebrow">Bill to</dt>
          <dd className="mt-1 text-ink-900">{inv.recipient}</dd>
          {inv.recipientEmail && <dd className="text-ink-500">{inv.recipientEmail}</dd>}
        </div>
        <div>
          <dt className="eyebrow">Issued</dt>
          <dd className="mt-1 text-ink-900">{inv.issuedAt ? formatDate(inv.issuedAt, "long") : "Draft"}</dd>
        </div>
        <div>
          <dt className="eyebrow">Due</dt>
          <dd className="mt-1 text-ink-900">{inv.dueAt ? formatDate(inv.dueAt, "long") : "On receipt"}</dd>
          {dealReference && <dd className="num text-ink-500">Deal {dealReference}</dd>}
        </div>
      </dl>
      <table className="mt-8 w-full text-small">
        <thead className="border-b border-hairline text-left text-axis tracking-[0.06em] text-ink-500 uppercase">
          <tr>
            <th className="py-2 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {inv.lines.map((l, i) => (
            <tr key={i} className="border-b border-hairline">
              <td className="py-3 pr-6 text-ink-900">{l.description}</td>
              <td className="num py-3 text-right">{m(l.amount)}</td>
            </tr>
          ))}
          <tr>
            <td className="py-2 text-right text-ink-700">Subtotal</td>
            <td className="num py-2 text-right">{m(inv.amount)}</td>
          </tr>
          <tr>
            <td className="py-2 text-right text-ink-700">
              {inv.tax.type} {inv.tax.ratePct ? `${inv.tax.ratePct}%` : ""}
            </td>
            <td className="num py-2 text-right">{m(inv.tax.amount)}</td>
          </tr>
          <tr className="border-t border-ink-900">
            <td className="py-3 text-right font-medium text-ink-900">Total</td>
            <td className="num py-3 text-right text-card text-navy-900">{m(inv.total)}</td>
          </tr>
          {inv.tax.tdsAmount ? (
            <tr>
              <td className="py-1 text-right text-ink-500">Less TDS under s.194H at {inv.tax.tdsPct}%, deducted by the payer</td>
              <td className="num py-1 text-right text-ink-500">({m(inv.tax.tdsAmount)})</td>
            </tr>
          ) : null}
        </tbody>
      </table>
      <p className="mt-8 text-axis text-ink-500">Payment by bank transfer quoting {inv.number}. {inv.tax.type === "India GST" ? "SAC 997222: real estate services on a fee or contract basis." : inv.tax.type === "UAE VAT" ? "Place of supply: United Arab Emirates (services connected with real estate)." : ""}</p>
    </article>
  );
}
