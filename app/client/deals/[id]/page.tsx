import { notFound } from "next/navigation";
import { PageHeader } from "@/components/composites/page-header";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { canSeeClient, requireRole } from "@/lib/auth";
import { JURISDICTION_LABEL, STAGE_LABEL } from "@/lib/deals/domain";
import { getDeal } from "@/lib/deals/service";
import { formatLocal } from "@/lib/format";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Transaction" };
export const dynamic = "force-dynamic";

export default async function ClientDeal({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const { id } = await params;
  const d = /^[0-9a-f-]{36}$/i.test(id) ? await getDeal(await getDb(), user.tenantId, id) : null;
  if (!d || !canSeeClient(user, d.deal.clientId) || (user.role !== "client" && user.clientId && d.deal.clientId !== user.clientId)) notFound();
  const money = (n: number) => formatLocal(n, d.deal.currency, { compact: false });
  const accepted = d.offers.find((o) => o.status === "accepted");
  const doneItems = d.checklist.filter((c) => c.status === "done" || c.status === "waived").length;
  return (
    <PageContainer>
      <PageHeader eyebrow={`${d.deal.side === "buy" ? "Purchase" : "Sale"} · ${JURISDICTION_LABEL[d.deal.jurisdiction]}`} title={d.property.name} subtitle={`${d.property.community}. Reference ${d.deal.reference}.`} meta={<><Flag tone={d.deal.status === "won" ? "complete" : "progress"}>{d.deal.status === "active" ? STAGE_LABEL[d.deal.stage] : d.deal.status === "won" ? "Completed" : d.deal.status}</Flag><span className="num">{money(d.deal.value)}</span>{accepted && <span>Price agreed {formatDate(accepted.responseAt ?? accepted.createdAt)}</span>}</>} />
      <ol className="mt-8 space-y-3">
        {d.stages.map((st) => (
          <li key={st.id} className="flex items-baseline gap-4">
            <span className={cn("size-2.5 shrink-0 rounded-full border", st.completedAt ? "border-navy-900 bg-navy-900" : st.enteredAt ? "border-gold-500 bg-gold-500" : "border-ink-200 bg-surface")} />
            <span className={cn("text-small", st.enteredAt ? "text-ink-900" : "text-ink-400")}>{STAGE_LABEL[st.name]}</span>
            {st.enteredAt && <span className="text-axis text-ink-500">{formatDate(st.enteredAt)}</span>}
          </li>
        ))}
      </ol>
      <Section title="Documents for signature">
        {d.contracts.length === 0 ? (
          <p className="text-small text-ink-500">Contracts appear here once the price is agreed.</p>
        ) : (
          <div className="space-y-3">
            {d.contracts.map((c) => (
              <details key={c.id} className="rounded-md border border-ink-200 bg-surface p-5 shadow-card">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                  <span className="font-medium text-ink-900">{c.title}</span>
                  <Flag tone={c.status === "signed" ? "complete" : "progress"}>{c.status === "out_for_signature" ? "Awaiting signatures" : c.status}</Flag>
                </summary>
                <div className="prose-pf mt-4 text-small" dangerouslySetInnerHTML={{ __html: c.contentHtml }} />
                <p className="mt-4 text-small text-ink-500">Signing links are sent by email to each signer. {d.signatures.filter((x) => x.contractId === c.id && x.status === "signed").length} of {d.signatures.filter((x) => x.contractId === c.id).length} signatures received.</p>
              </details>
            ))}
          </div>
        )}
      </Section>
      <Section title="Payments">
        <SimpleTable
          rows={d.payments}
          empty="The payment schedule is set when the contract is signed."
          minWidth={560}
          columns={[
            { key: "m", header: "Milestone", cell: (p) => p.milestone },
            { key: "a", header: "Amount", numeric: true, cell: (p) => money(p.amount) },
            { key: "d", header: "Due", cell: (p) => formatDate(p.dueDate) },
            { key: "s", header: "Status", cell: (p) => <Flag tone={p.status === "paid" ? "complete" : p.status === "overdue" ? "error" : p.status === "due" ? "progress" : "neutral"}>{p.status}</Flag> },
          ]}
        />
      </Section>
      <Section title="Closing" description={`${doneItems} of ${d.checklist.length} closing steps complete. Your advisers will contact you for anything needed from you.`}>
        <div className="h-2 overflow-hidden rounded-full bg-ink-200">
          <div className="h-full bg-navy-900" style={{ width: `${d.checklist.length ? (doneItems / d.checklist.length) * 100 : 0}%` }} />
        </div>
      </Section>
    </PageContainer>
  );
}
