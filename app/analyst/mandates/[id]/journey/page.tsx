import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/composites/page-header";
import { Flag } from "@/components/os/badges";
import { RunAgent } from "@/components/os/run-agent";
import { Section } from "@/components/os/simple-table";
import { Crumb } from "@/components/shell/crumb";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { formatLocal, STAGE_LABEL } from "@/lib/domain";
import { mandateJourney } from "@/lib/os/journey";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Journey" };
export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  "mandate.created": "Mandate created",
  "mandate.researched": "Research complete",
  "mandate.approved": "Memo approved and delivered",
  "deal.created": "Deal opened",
  "deal.offer_sent": "Offer sent",
  "deal.contract_signed": "Contract signed",
  "deal.closed": "Deal closed",
  "commission.computed": "Commission computed",
  "invoice.paid": "Invoice paid",
};

/** Causal order, to break ties between events recorded in the same instant. */
const EVENT_ORDER = Object.keys(EVENT_LABEL);

type Item = { at: Date; kind: "stage" | "event"; title: string; detail?: string; href?: string; agents?: { agent: string; status: string; costUsd: number; summary?: string }[] };

export default async function Journey({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { id } = await params;
  const db = await getDb();
  const j = await mandateJourney(db, user.tenantId, id);
  if (!j) notFound();
  const { mandate: m, deals, commissions, invoices, events } = j;
  const narration = await lastOutput(user.tenantId, "audit-narrator", `Journey ${m.reference}`);
  const deal = deals.at(-1);
  const commission = commissions.find((c) => c.dealId === deal?.id);
  const invoice = invoices.find((i) => i.dealId === deal?.id);

  const seen = new Set(events.map((e) => e.type));
  const items: (Item & { order: number })[] = [
    // Research and delivery are shown by their bus events when those exist.
    ...m.timeline
      .filter((r) => r.status === "complete" && r.completedAt && r.stage !== "INTAKE" && !(r.stage === "RESEARCH" && seen.has("mandate.researched")) && !(r.stage === "DELIVERED" && seen.has("mandate.approved")))
      .map((r) => ({ at: new Date(r.completedAt!), order: 0, kind: "stage" as const, title: `${STAGE_LABEL[r.stage as keyof typeof STAGE_LABEL] ?? r.stage} complete`, detail: r.model === "human" || r.stage === "REVIEW" ? "Reviewed and approved by the advisory team" : `${r.agent} agent${r.costUsd ? ` · $${r.costUsd.toFixed(3)}` : ""}` })),
    ...events.map((e) => ({ at: e.createdAt, order: EVENT_ORDER.indexOf(e.type), kind: "event" as const, title: EVENT_LABEL[e.type] ?? e.type, detail: typeof e.payload.label === "string" ? e.payload.label : undefined, href: typeof e.payload.href === "string" ? e.payload.href : undefined, agents: e.agents })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime() || a.order - b.order);
  const agentRuns = events.flatMap((e) => e.agents);
  const agentCost = agentRuns.reduce((a, r) => a + r.costUsd, 0) + m.totalCostUsd;

  const rail = [
    { label: "Mandate", value: m.reference, note: STAGE_LABEL[m.status], done: m.status === "DELIVERED", href: `/analyst/mandates/${m.id}` },
    { label: "Deal", value: deal?.reference ?? "Not opened", note: deal ? `${deal.status === "won" ? "Closed" : deal.stage.replace(/_/g, " ")} · ${formatLocal(deal.value, deal.currency)}` : "Opens when the client instructs", done: deal?.status === "won", href: deal ? `/analyst/deals/${deal.id}` : undefined },
    { label: "Commission", value: commission ? formatLocal(commission.amount, commission.currency) : "Not computed", note: commission ? commission.status.replace(/_/g, " ") : "Computed on close", done: Boolean(commission), href: commission ? "/admin/commissions" : undefined },
    { label: "Invoice", value: invoice?.number ?? "Not issued", note: invoice ? `${invoice.status.replace(/_/g, " ")} · ${formatLocal(invoice.total, invoice.currency)}` : "Issued with the commission", done: invoice?.status === "paid", href: invoice ? `/admin/invoices/${invoice.id}` : undefined },
  ];

  return (
    <>
      <Crumb segment={m.id} label={m.reference} />
      <PageContainer>
        <PageHeader
          eyebrow={`${m.reference} · Journey`}
          title={m.title}
          subtitle="From brief to cash: every stage, event and agent that followed from this mandate, in order. Each event on the bus starts the agents registered for it; their conclusions are shown where they ran."
          actions={
            <Link href={`/analyst/mandates/${m.id}`} className="text-small text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
              Back to mandate
            </Link>
          }
        />

        <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {rail.map((r, i) => {
            const body = (
              <>
                <div className="flex items-center justify-between">
                  <span className="eyebrow">
                    <span className="num mr-2 text-ink-500">{String(i + 1).padStart(2, "0")}</span>
                    {r.label}
                  </span>
                  <Flag tone={r.done ? "complete" : r.href ? "progress" : "neutral"}>{r.done ? "Done" : r.href ? "Open" : "Pending"}</Flag>
                </div>
                <div className="num mt-3 text-[20px] text-navy-900">{r.value}</div>
                <div className="mt-1 text-small text-ink-500 capitalize">{r.note}</div>
              </>
            );
            return (
              <li key={r.label} className={cn("rounded-lg border bg-surface p-5 shadow-card", r.done ? "border-success/30" : "border-ink-200")}>
                {r.href ? (
                  <Link href={r.href} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ol>

        <section className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-small text-ink-500">
          <span>
            <span className="num text-ink-900">{events.length}</span> events on the bus
          </span>
          <span>
            <span className="num text-ink-900">{agentRuns.length + m.timeline.filter((r) => r.agent !== "human").length}</span> agent runs
          </span>
          <span>
            <span className="num text-ink-900">${agentCost.toFixed(2)}</span> AI cost end to end
          </span>
          {deal && (
            <span>
              <span className="num text-ink-900">{Math.max(0, Math.round(((deal.actualCloseDate ? new Date(deal.actualCloseDate) : new Date()).getTime() - m.createdAt.getTime()) / 86_400_000))}</span> days from brief to {deal.status === "won" ? "close" : "today"}
            </span>
          )}
        </section>

        <Section title="Timeline">
          <ol className="relative ml-2 border-l border-ink-200">
            {items.map((it, i) => (
              <li key={i} className="relative pb-7 pl-7 last:pb-0">
                <span className={cn("absolute top-1.5 -left-[5px] size-2.5 rounded-full border-2 border-canvas", it.kind === "stage" ? "bg-navy-700" : "bg-gold-500")} aria-hidden />
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="num text-[12px] text-ink-500">{formatDate(it.at, "datetime")}</span>
                  <span className="text-body font-medium text-ink-900">{it.title}</span>
                  {it.href && (
                    <Link href={it.href} className="text-small text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
                      Open
                    </Link>
                  )}
                </div>
                {it.detail && <p className="mt-0.5 text-small text-ink-700">{it.detail}</p>}
                {it.agents && it.agents.length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {it.agents.map((a, k) => (
                      <li key={k} className="rounded-md border border-ink-200 bg-surface px-3 py-2 text-small">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num text-[12px] text-ink-900">{a.agent}</span>
                          <Flag tone={a.status === "succeeded" ? "complete" : a.status === "failed" ? "error" : "neutral"}>{a.status}</Flag>
                          {a.costUsd > 0 && <span className="num text-[12px] text-ink-500">${a.costUsd.toFixed(4)}</span>}
                        </div>
                        {a.summary && <p className="mt-1 text-ink-700">{a.summary}</p>}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Audit narration" description={`The audit narrator reads all ${j.audit.length} audit entries behind this journey and writes them up as a compliance officer would want to read them.`}>
          <RunAgent endpoint={`/api/mandates/${m.id}/narrate`} body={{}} agentLabel="Audit narrator" action="Narrate this journey" initial={narration} />
        </Section>
      </PageContainer>
    </>
  );
}
