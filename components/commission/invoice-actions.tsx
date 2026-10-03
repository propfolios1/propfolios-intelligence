"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { StructuredDetail } from "@/components/os/structured-detail";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { post } from "./post";

export function RecordPayment({ id, currency, outstanding }: { id: string; currency: string; outstanding: number }) {
  const router = useRouter();
  const [amount, setAmount] = React.useState<number | null>(outstanding);
  const [method, setMethod] = React.useState("bank_transfer");
  const [reference, setReference] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  return (
    <form
      className="grid gap-3 rounded-md border border-hairline bg-surface p-5 shadow-card sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await post(`/api/invoices/${id}/payment`, { amount, method, reference, receivedAt: date }, { ok: "Payment recorded" })) router.refresh();
      }}
    >
      <FormField label="Amount received">
        <MoneyInput value={amount} onChange={setAmount} currency={currency} />
      </FormField>
      <FormField label="Received on">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </FormField>
      <FormField label="Method">
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="bank_transfer">Bank transfer</option>
          <option value="cheque">Cheque</option>
          <option value="card">Card</option>
          <option value="cash">Cash</option>
        </Select>
      </FormField>
      <FormField label="Bank reference">
        <Input value={reference} onChange={(e) => setReference(e.target.value)} />
      </FormField>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" disabled={!amount || reference.trim().length < 2}>
          Record payment
        </Button>
      </div>
    </form>
  );
}

export function InvoiceButtons({ id, status, email }: { id: string; status: string; email: string | null }) {
  const router = useRouter();
  const [to, setTo] = React.useState(email ?? "");
  return (
    <div className="flex flex-wrap items-end gap-2" data-no-print>
      <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="accounts@payer.com" className="w-60" aria-label="Recipient email" />
      <Button variant="secondary" disabled={!/@/.test(to)} onClick={async () => void ((await post(`/api/invoices/${id}/send`, { to }, { ok: "Invoice sent" })) && router.refresh())}>
        Send
      </Button>
      <Button variant="secondary" onClick={() => window.print()}>
        Print
      </Button>
      {status !== "paid" && status !== "void" && (
        <Button variant="destructive" onClick={async () => void ((await post(`/api/invoices/${id}/void`, {}, { ok: "Invoice voided; the commission is open for re-invoicing" })) && router.refresh())}>
          Void
        </Button>
      )}
    </div>
  );
}

type Recon = { matched: number; unmatched: number; rows: { line: number; date: string; amount: number; reference: string; invoice: string | null; rule: string | null }[] };

/** Bank statement CSV: preview the matches, then apply them as payments. */
export function ReconcilePanel() {
  const router = useRouter();
  const [csv, setCsv] = React.useState("");
  const [preview, setPreview] = React.useState<Recon | null>(null);
  const [applied, setApplied] = React.useState(false);
  const run = async (apply: boolean) => {
    const r = await post("/api/invoices/reconcile", { csv, apply }, { ok: apply ? "Payments recorded" : undefined, fail: "Statement not read" });
    if (r) {
      setPreview(r);
      setApplied(apply);
      if (apply) router.refresh();
    }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-hairline bg-surface p-5 shadow-card">
        <FormField label="Bank statement (CSV)" hint="Columns: date, amount, reference. Matched by invoice number in the reference, then by a unique exact amount.">
          <Textarea rows={6} className="font-mono text-axis" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"Date,Amount,Reference\n2026-09-24,66780,TRF INV-2026-0001"} />
        </FormField>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setCsv(await f.text());
            }}
            className="text-small text-ink-700"
          />
          <Button variant="secondary" disabled={csv.length < 10} onClick={() => void run(false)}>
            Preview matches
          </Button>
          <Button disabled={!preview || applied || preview.matched === 0} onClick={() => void run(true)}>
            Apply {preview?.matched ?? 0} matches
          </Button>
        </div>
      </div>
      {preview && (
        <div className="overflow-x-auto rounded-md border border-hairline bg-surface shadow-card">
          <table className="w-full min-w-[640px] text-small">
            <thead className="bg-navy-50 text-left text-axis tracking-[0.06em] text-ink-500 uppercase">
              <tr>
                <th className="px-4 py-2">Line</th>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2 text-right">Amount</th>
                <th className="px-4 py-2">Reference</th>
                <th className="px-4 py-2">Invoice</th>
                <th className="px-4 py-2">Rule</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((r) => (
                <tr key={r.line} className="border-t border-hairline">
                  <td className="num px-4 py-2">{r.line}</td>
                  <td className="px-4 py-2">{r.date}</td>
                  <td className="num px-4 py-2 text-right">{r.amount.toLocaleString("en-US")}</td>
                  <td className="px-4 py-2">{r.reference}</td>
                  <td className="num px-4 py-2">{r.invoice ?? <span className="text-warning">Unmatched</span>}</td>
                  <td className="px-4 py-2">{r.rule ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function TaxReportPanel() {
  const [type, setType] = React.useState("uae_vat");
  const now = new Date();
  const [period, setPeriod] = React.useState(`${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`);
  const [report, setReport] = React.useState<{ data: { rows: { label: string; amount: number }[]; totals: Record<string, number>; currency: string; invoices: number } } | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-md border border-hairline bg-surface p-5 shadow-card">
        <FormField label="Return">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="uae_vat">UAE VAT (VAT201)</option>
            <option value="india_gst">India GST (GSTR-1, 3B)</option>
            <option value="india_tds_194h">India TDS under s.194H</option>
          </Select>
        </FormField>
        <FormField label="Period" hint="YYYY-MM or YYYY-Q1 to Q4">
          <Input value={period} onChange={(e) => setPeriod(e.target.value)} className="num w-36" />
        </FormField>
        <Button onClick={async () => setReport(await post("/api/commissions/tax-reports", { period, type }, { fail: "Report not generated" }))}>Generate</Button>
      </div>
      {report && (
        <div className="rounded-md border border-hairline bg-surface p-5 shadow-card">
          <div className="eyebrow">{report.data.invoices} invoices</div>
          <table className="mt-3 w-full text-small">
            <tbody>
              {report.data.rows.map((r) => (
                <tr key={r.label} className="border-t border-hairline first:border-t-0">
                  <td className="py-2 pr-4 text-ink-700">{r.label}</td>
                  <td className="num py-2 text-right text-ink-900">
                    {report.data.currency} {Math.round(r.amount).toLocaleString(report.data.currency === "INR" ? "en-IN" : "en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <StructuredDetail output={{ totals: report.data.totals }} className="mt-4" />
        </div>
      )}
    </div>
  );
}

export function SplitStatus({ commissionId, splitId, status }: { commissionId: string; splitId: string; status: string }) {
  const router = useRouter();
  const next = status === "pending" ? "approved" : status === "approved" ? "paid" : null;
  if (!next) return <span className="text-small text-success">Paid</span>;
  return (
    <Button size="sm" variant="secondary" onClick={async () => void ((await post(`/api/commissions/${commissionId}/split`, { splitId, status: next }, { ok: next === "approved" ? "Split approved" : "Split marked paid" })) && router.refresh())}>
      {next === "approved" ? "Approve" : "Mark paid"}
    </Button>
  );
}
