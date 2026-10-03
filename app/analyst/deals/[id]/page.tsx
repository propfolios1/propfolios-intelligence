import { and, desc, eq, inArray, or } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/composites/page-header";
import { ChecklistToggle, CloseDeal, GenerateContract, OfferForm, OfferResponse, PaymentButton, RoundForm, SendForSignature, SubmitDraft } from "@/components/deals/deal-actions";
import { Flag, Severity } from "@/components/os/badges";
import { RunAgent } from "@/components/os/run-agent";
import { activeTab, SectionTabs } from "@/components/os/section-tabs";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { CONTRACT_TYPES, DEAL_TYPE_LABEL, JURISDICTION_LABEL, STAGE_LABEL } from "@/lib/deals/domain";
import { getDeal } from "@/lib/deals/service";
import { formatLocal } from "@/lib/format";
import { cn, formatDate, formatUsdCost } from "@/lib/utils";

export const metadata = { title: "Deal" };
export const dynamic = "force-dynamic";

const TABS = [
  ["overview", "Overview"],
  ["offers", "Offers"],
  ["negotiations", "Negotiations"],
  ["contracts", "Contracts"],
  ["checklist", "Checklist"],
  ["payments", "Payments"],
  ["audit", "Audit"],
] as const;

const OFFER_TONE = { draft: "neutral", submitted: "progress", accepted: "complete", rejected: "error", countered: "neutral", expired: "neutral", withdrawn: "neutral" } as const;
const PAY_TONE = { scheduled: "neutral", due: "progress", paid: "complete", overdue: "error", waived: "neutral" } as const;

async function initial(tenantId: string, agent: string, id: string) {
  const r = await lastOutput(tenantId, agent, id);
  return r ? { output: r.output as never, model: r.model, costUsd: r.costUsd, at: r.at } : null;
}

export default async function DealPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { id } = await params;
  const tab = activeTab(TABS, (await searchParams).tab);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const d = await getDeal(db, user.tenantId, id);
  if (!d) notFound();
  const { deal } = d;
  const cur = deal.currency;
  const money = (n: number) => formatLocal(n, cur, { compact: false });
  const signed = d.contracts.some((c) => c.status === "signed");
  const openCritical = d.checklist.filter((c) => c.severity === "CRITICAL" && (c.status === "open" || c.status === "in_progress"));
  const closeBlock = deal.status !== "active" ? "The deal is not active." : !signed ? "A signed contract is required." : openCritical.length ? `${openCritical.length} critical checklist items are open.` : undefined;
  const lastSubmitted = [...d.offers].reverse().find((o) => o.status === "submitted");
  const [predictor, strategist, coach, coordinator, reviewer, reminder] = await Promise.all(["deal-predictor", "offer-strategist", "negotiation-coach", "closing-coordinator", "contract-reviewer", "payment-reminder"].map((a) => initial(user.tenantId, a, a === "contract-reviewer" ? (d.contracts[0]?.id ?? id) : id)));
  const audit =
    tab === "audit"
      ? await db
          .select()
          .from(s.auditLogs)
          .where(and(eq(s.auditLogs.tenantId, user.tenantId), or(eq(s.auditLogs.entityId, id), d.contracts.length ? inArray(s.auditLogs.entityId, d.contracts.map((c) => c.id)) : undefined, d.payments.length ? inArray(s.auditLogs.entityId, d.payments.map((p) => p.id)) : undefined, d.checklist.length ? inArray(s.auditLogs.entityId, d.checklist.map((c) => c.id)) : undefined)))
          .orderBy(desc(s.auditLogs.createdAt))
          .limit(100)
      : [];
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Link href="/analyst/deals">Deals · {JURISDICTION_LABEL[deal.jurisdiction]} · {DEAL_TYPE_LABEL[deal.dealType]}</Link>}
        title={deal.title}
        subtitle={`${deal.side === "buy" ? "Acting for the buyer" : "Acting for the seller"}, ${d.client.name}. Counterparty: ${deal.counterparty}.`}
        meta={
          <>
            <span className="num">{deal.reference}</span>
            <Flag tone={deal.status === "won" ? "complete" : deal.status === "lost" ? "error" : "progress"}>{deal.status === "active" ? STAGE_LABEL[deal.stage] : deal.status}</Flag>
            <span className="num">{money(deal.value)}</span>
            {deal.probability !== null && <span className="num">{Math.round(deal.probability * 100)}% probability</span>}
            {deal.targetCloseDate && <span>Target {formatDate(deal.targetCloseDate)}</span>}
            {deal.mandateId && (
              <Link href={`/analyst/mandates/${deal.mandateId}/journey`} className="underline decoration-ink-200 underline-offset-4">
                Journey
              </Link>
            )}
          </>
        }
        actions={deal.status === "active" ? <CloseDeal dealId={id} disabledReason={closeBlock} /> : undefined}
      />
      <ol className="mt-6 grid grid-cols-7 gap-1" aria-label="Stages">
        {d.stages.map((st) => (
          <li key={st.id} className="min-w-0">
            <div className={cn("h-1 rounded-full", st.completedAt ? "bg-navy-900" : st.enteredAt ? "bg-gold-500" : "bg-ink-200")} />
            <div className={cn("mt-2 truncate text-axis", st.enteredAt ? "text-ink-900" : "text-ink-400")}>{STAGE_LABEL[st.name]}</div>
          </li>
        ))}
      </ol>
      <div className="mt-6">
        <SectionTabs base={`/analyst/deals/${id}`} tabs={TABS} active={tab} label="Deal sections" />
      </div>

      {tab === "overview" && (
        <div className="grid gap-x-8 xl:grid-cols-2">
          <Section title="Forecast" eyebrow="Agent 19 · Deal predictor">
            <RunAgent endpoint={`/api/deals/${id}/agent`} body={{ agent: "deal-predictor" }} agentLabel="Deal predictor" initial={predictor} refresh />
          </Section>
          <Section title="Closing plan" eyebrow="Agent 23 · Closing coordinator">
            <RunAgent endpoint={`/api/deals/${id}/agent`} body={{ agent: "closing-coordinator" }} agentLabel="Closing coordinator" initial={coordinator} />
          </Section>
          <Section title="Timeline" eyebrow="Events" className="xl:col-span-2">
            <ol className="space-y-3">
              {d.events.map((e) => (
                <li key={e.id} className="rounded-md border border-ink-200 bg-surface p-4 shadow-card">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="num text-small text-ink-900">{e.type}</span>
                    <RelativeTime iso={e.createdAt.toISOString()} className="text-axis text-ink-500" />
                  </div>
                  <div className="mt-1 text-small text-ink-700">{String(e.payload.label ?? "")}</div>
                  {e.agents.length > 0 && (
                    <ul className="mt-2 space-y-1 text-small">
                      {e.agents.map((a, k) => (
                        <li key={k} className="flex gap-2">
                          <Flag tone={a.status === "succeeded" ? "complete" : a.status === "failed" ? "error" : "neutral"}>{a.agent}</Flag>
                          <span className="text-ink-700">{a.summary}</span>
                          <span className="num ml-auto text-ink-500">{formatUsdCost(a.costUsd)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </Section>
        </div>
      )}

      {tab === "offers" && (
        <>
          <Section title="Offers and counters" actions={deal.status === "active" ? <OfferForm dealId={id} currency={cur} side={deal.side} /> : undefined}>
            <SimpleTable
              rows={d.offers}
              minWidth={900}
              empty="No offers yet."
              columns={[
                { key: "t", header: "Type", cell: (o) => <span className="capitalize">{o.type}</span> },
                { key: "p", header: "From", cell: (o) => <span className="capitalize">{o.party}</span> },
                { key: "a", header: "Amount", numeric: true, cell: (o) => money(o.amount) },
                { key: "terms", header: "Terms", cell: (o) => [o.terms.depositPct !== undefined ? `${o.terms.depositPct}% deposit` : null, o.terms.completionDays ? `${o.terms.completionDays} days` : null, ...(o.terms.conditions ?? [])].filter(Boolean).join(" · ") || "None" },
                { key: "s", header: "Status", cell: (o) => <Flag tone={OFFER_TONE[o.status]}>{o.status}</Flag> },
                { key: "d", header: "Submitted", cell: (o) => (o.submittedAt ? formatDate(o.submittedAt) : "Draft") },
                { key: "x", header: "", cell: (o) => (o.status === "submitted" && deal.status === "active" ? <div className="flex flex-wrap gap-2"><OfferResponse dealId={id} offerId={o.id} /><OfferForm dealId={id} currency={cur} side={deal.side} parentOfferId={o.id} defaultParty={o.party === "buyer" ? "seller" : "buyer"} label="Counter" /></div> : o.status === "draft" ? <SubmitDraft dealId={id} offerId={o.id} /> : null) },
              ]}
            />
          </Section>
          <Section title="Offer strategy" eyebrow="Agent 20 · Offer strategist">
            <RunAgent endpoint={`/api/deals/${id}/agent`} body={{ agent: "offer-strategist" }} agentLabel="Offer strategist" initial={strategist} />
          </Section>
        </>
      )}

      {tab === "negotiations" && (
        <>
          <Section title="Next move" eyebrow="Agent 21 · Negotiation coach">
            <RunAgent endpoint={`/api/deals/${id}/agent`} body={{ agent: "negotiation-coach" }} agentLabel="Negotiation coach" initial={coach} />
          </Section>
          <Section title="Rounds">
            <SimpleTable
              rows={d.rounds}
              minWidth={800}
              empty="No rounds recorded."
              columns={[
                { key: "n", header: "Round", numeric: true, cell: (r) => r.roundNumber },
                { key: "p", header: "Party", cell: (r) => <span className="capitalize">{r.party}</span> },
                { key: "pr", header: "Price", numeric: true, cell: (r) => (r.position.price ? money(r.position.price) : "None") },
                { key: "a", header: "Asks", cell: (r) => r.position.asks.join("; ") || "None" },
                { key: "c", header: "Concessions", cell: (r) => r.position.concessions.join("; ") || "None" },
                { key: "d", header: "Date", cell: (r) => formatDate(r.submittedAt) },
              ]}
            />
          </Section>
          {deal.status === "active" && (
            <Section title="Record a round">
              <RoundForm dealId={id} currency={cur} />
            </Section>
          )}
        </>
      )}

      {tab === "contracts" && (
        <>
          {deal.status === "active" && (
            <Section title="Draft a contract" description={lastSubmitted ? "An offer is still open; contracts are normally drafted from the accepted offer." : "Drafted from the accepted offer's terms in the jurisdiction's standard form; the contract reviewer reads each new draft."}>
              <GenerateContract dealId={id} types={CONTRACT_TYPES[deal.jurisdiction]} />
            </Section>
          )}
          {d.contracts.map((c) => {
            const sigs = d.signatures.filter((x) => x.contractId === c.id);
            return (
              <Section key={c.id} title={`${c.title}, version ${c.version}`} eyebrow={`${c.provider === "dropbox_sign" ? "Dropbox Sign" : "Native signature"} · ${c.status.replace(/_/g, " ")}`} actions={c.status === "draft" ? <SendForSignature dealId={id} contractId={c.id} defaults={[{ party: deal.side === "buy" ? "buyer" : "seller", name: d.client.name, email: `${d.client.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@clients.example` }, { party: deal.side === "buy" ? "seller" : "buyer", name: deal.counterparty, email: `${deal.counterparty.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@counterparty.example` }]} /> : undefined}>
                <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
                  <article className="prose-pf max-h-[520px] overflow-y-auto rounded-md border border-ink-200 bg-surface p-6 text-small shadow-card" dangerouslySetInnerHTML={{ __html: c.contentHtml }} />
                  <div className="space-y-3">
                    <div className="rounded-md border border-ink-200 bg-surface p-4 text-small shadow-card">
                      <div className="eyebrow mb-2">Integrity</div>
                      <div className="num break-all text-axis text-ink-700">SHA-256 {c.contentHash}</div>
                    </div>
                    {sigs.map((x) => (
                      <div key={x.id} className="rounded-md border border-ink-200 bg-surface p-4 text-small shadow-card">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-ink-900">{x.signerName}</span>
                          <Flag tone={x.status === "signed" ? "complete" : x.status === "declined" ? "error" : "progress"}>{x.status}</Flag>
                        </div>
                        <div className="text-ink-700 capitalize">{x.party}</div>
                        <div className="text-ink-500">{x.signerEmail}</div>
                        {x.signedAt && <div className="num mt-1 text-axis text-ink-500">{x.signedAt.toISOString().replace("T", " ").slice(0, 19)} UTC · {x.ipAddress ?? "address not recorded"}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </Section>
            );
          })}
          {d.contracts.length > 0 && (
            <Section title="Contract review" eyebrow="Agent 22 · Contract reviewer">
              <RunAgent endpoint={`/api/deals/${id}/agent`} body={{ agent: "contract-reviewer", contractId: d.contracts[0]!.id }} agentLabel="Contract reviewer" initial={reviewer} />
            </Section>
          )}
        </>
      )}

      {tab === "checklist" && (
        <Section title="Closing checklist" description={`${d.checklist.filter((c) => c.status === "done" || c.status === "waived").length} of ${d.checklist.length} complete, from the ${JURISDICTION_LABEL[deal.jurisdiction]} rules engine.`}>
          <SimpleTable
            rows={d.checklist}
            minWidth={900}
            columns={[
              { key: "x", header: "", cell: (c) => <ChecklistToggle dealId={id} itemId={c.id} status={c.status} /> },
              { key: "i", header: "Item", cell: (c) => <span className={cn("text-ink-900", c.status === "done" && "text-ink-500 line-through")}>{c.item}</span> },
              { key: "s", header: "Severity", cell: (c) => <Severity level={c.severity} /> },
              { key: "c", header: "Authority", cell: (c) => c.category },
              { key: "r", header: "Reference", cell: (c) => c.reference },
              { key: "d", header: "Due", cell: (c) => (c.dueDate ? <span className={c.status !== "done" && new Date(c.dueDate) < new Date() ? "text-danger" : undefined}>{formatDate(c.dueDate)}</span> : "None") },
            ]}
          />
        </Section>
      )}

      {tab === "payments" && (
        <>
          <Section title="Payment schedule" description={d.payments.length ? `${money(d.payments.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0))} of ${money(d.payments.reduce((a, p) => a + p.amount, 0))} received.` : "The schedule is created when the contract is signed by every party."}>
            <SimpleTable
              rows={d.payments}
              empty="No schedule yet."
              columns={[
                { key: "m", header: "Milestone", cell: (p) => <span className="text-ink-900">{p.milestone}</span> },
                { key: "a", header: "Amount", numeric: true, cell: (p) => money(p.amount) },
                { key: "d", header: "Due", cell: (p) => formatDate(p.dueDate) },
                { key: "s", header: "Status", cell: (p) => <Flag tone={PAY_TONE[p.status]}>{p.status}</Flag> },
                { key: "r", header: "Reference", cell: (p) => <span className="num">{p.reference ?? "None"}</span> },
                { key: "x", header: "", cell: (p) => <PaymentButton dealId={id} paymentId={p.id} status={p.status} /> },
              ]}
            />
          </Section>
          <Section title="Reminders" eyebrow="Agent 24 · Payment reminder">
            <RunAgent endpoint={`/api/deals/${id}/agent`} body={{ agent: "payment-reminder" }} agentLabel="Payment reminder" initial={reminder} />
          </Section>
        </>
      )}

      {tab === "audit" && (
        <Section title="Audit" description="Every mutation on the deal, its contracts, checklist and payments, with the actor, address and before and after values.">
          <SimpleTable
            rows={audit}
            minWidth={1000}
            columns={[
              { key: "w", header: "When", cell: (a) => <RelativeTime iso={a.createdAt.toISOString()} /> },
              { key: "a", header: "Actor", cell: (a) => a.actorName },
              { key: "x", header: "Action", cell: (a) => a.action },
              { key: "ip", header: "Address", cell: (a) => <span className="num">{a.ip ?? "None"}</span> },
              { key: "r", header: "Request", cell: (a) => <span className="num text-axis">{a.requestId?.slice(0, 12) ?? "None"}</span> },
              { key: "c", header: "Change", cell: (a) => <span className="text-axis">{a.after ? JSON.stringify(a.after).slice(0, 140) : a.model ? `${a.model} · ${formatUsdCost(a.costUsd ?? 0)}` : "None"}</span> },
            ]}
          />
        </Section>
      )}
    </PageContainer>
  );
}
