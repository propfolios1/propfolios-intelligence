import Link from "next/link";
import { ActivityFeed } from "@/components/composites/activity-feed";
import { ActionsPanel, ProposeActionDialog } from "@/components/intelligence/action-button";
import { CrossValidationBadge, CrossValidationPanel } from "@/components/intelligence/cross-validation";
import { DocumentCard } from "@/components/composites/document-card";
import { DocumentUpload } from "@/components/composites/document-upload";
import { EmptyState } from "@/components/composites/empty-state";
import { DDTab } from "@/components/composites/mandate/dd-tab";
import { DebateTab } from "@/components/composites/mandate/debate-tab";
import { LiveMandate, LiveStatusLine, LiveTimeline } from "@/components/composites/mandate/live-mandate";
import { OverviewTab } from "@/components/composites/mandate/overview-tab";
import { ResearchTab } from "@/components/composites/mandate/research-tab";
import { RunControls } from "@/components/composites/mandate/run-controls";
import { MANDATE_TABS, TabBar, type MandateTab } from "@/components/composites/mandate/tab-bar";
import { UnderwritingTab } from "@/components/composites/mandate/underwriting-tab";
import { MemoEditor, type MemoFlag } from "@/components/composites/memo-editor";
import { MemoStatusPill, StagePill } from "@/components/composites/status";
import { Crumb } from "@/components/shell/crumb";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatAed, formatLocal, STAGE_LABEL } from "@/lib/domain";
import { getMandateDetail, type MandateDetail } from "@/lib/queries";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const user = await requireRole(["tenant_admin", "analyst"]);
    const d = await getMandateDetail(await getDb(), user, id);
    return { title: `${d.mandate.reference} ${d.mandate.title}` };
  } catch {
    return { title: "Mandate" };
  }
}

function Pending({ stage }: { stage: string }) {
  return <EmptyState glyph="mandates" headline={`The ${stage.toLowerCase()} agent has not run yet.`} note="Run or resume the agents from the controls above. This tab fills in as soon as the stage completes." />;
}

/** Compares every key metric in the memo with the engine's figures. */
function factCheck(d: MandateDetail): MemoFlag[] {
  if (!d.memo) return [];
  const text = d.memo.contentHtml.replace(/<[^>]+>/g, " ");
  const p50 = d.simulation?.scenarios.find((s) => s.label === "P50");
  const flags: MemoFlag[] = d.memo.keyMetrics.map((k) => ({
    claim: `${k.label}: ${k.value}`,
    issue: text.includes(k.value) ? "verified" : "missing_citation",
    severity: text.includes(k.value) ? "low" : "medium",
    suggestion: text.includes(k.value) ? "Figure appears in the memo body." : "Key metric does not appear in the memo body. Add it or confirm the figure.",
  }));
  if (p50 && !text.includes(`${p50.irr.toFixed(1)}%`)) flags.unshift({ claim: `P50 IRR ${p50.irr.toFixed(1)}%`, issue: "contradicts_source", severity: "high", suggestion: "The memo does not state the engine's P50 IRR. Re-run the memo or correct the figure." });
  return flags;
}

export default async function MandatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const d = await getMandateDetail(await getDb(), user, id);
  const tab: MandateTab = MANDATE_TABS.some(([k]) => k === rawTab) ? (rawTab as MandateTab) : "overview";
  const { mandate: m, client, property: p } = d;
  const memoReadOnly = d.memo?.status === "delivered";

  return (
    <LiveMandate mandateId={m.id} initial={{ status: m.status, timeline: m.timeline, running: Boolean(m.runningSince), totalCostUsd: m.totalCostUsd }}>
      <Crumb segment={m.id} label={m.reference} />
      <PageContainer className="pt-8 md:pt-10">
        <header className="flex flex-col gap-6 border-b border-ink-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="num text-small text-ink-500">{m.reference}</span>
              <StagePill status={m.status} />
              {m.priority === "priority" && <span className="eyebrow text-gold-600">Priority</span>}
              {d.crossValidation && <CrossValidationBadge agreement={d.crossValidation.agreement} consensus={d.crossValidation.consensus} flagged={m.requiresReview} />}
            </div>
            <h1 className="mt-3 font-display text-section text-navy-900 md:text-title">{m.title}</h1>
            <p className="mt-2 text-body text-ink-700">
              {client.name} · {p.name}, {p.community} · {formatAed(m.ticketSizeAed)} over {m.horizonYears} years
            </p>
            <div className="mt-2">
              <LiveStatusLine />
            </div>
          </div>
          <RunControls mandateId={m.id} reference={m.reference} memoId={d.memo?.id ?? null} memoStatus={d.memo?.status ?? null} canDelete={user.role === "tenant_admin" || m.status !== "DELIVERED"} />
        </header>

        <TabBar id={m.id} active={tab} counts={{ dd: d.findings.length, documents: d.documents.length, actions: d.actions.filter((a) => a.status === "proposed").length, audit: d.audit.length }} />

        <div className="pt-8">
          {tab === "overview" && <OverviewTab d={d} />}
          {tab === "overview" && (
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
              <Card className="xl:col-span-7">
                <CardHeader eyebrow="Server-sent events" title="Agent timeline" />
                <CardContent>
                  <LiveTimeline />
                </CardContent>
              </Card>
              <Card className="xl:col-span-5">
                <CardHeader eyebrow="Agent runs" title="Model calls and cost" />
                <CardContent>
                  <ActivityFeed linkMandates={false} items={d.audit.filter((a) => a.actorType === "agent").map((a) => ({ ...a, reference: null }))} />
                </CardContent>
              </Card>
            </div>
          )}
          {tab === "research" && (d.research ? <ResearchTab research={d.research} /> : <Pending stage={STAGE_LABEL.RESEARCH} />)}
          {tab === "underwriting" && (d.simulation ? <UnderwritingTab sim={d.simulation} currency={p.currency} /> : <Pending stage={STAGE_LABEL.UNDERWRITING} />)}
          {tab === "dd" && (d.findings.length ? <DDTab findings={d.findings} /> : <Pending stage={STAGE_LABEL.DUE_DILIGENCE} />)}
          {tab === "debate" &&
            (d.debate ? (
              <div className="flex flex-col gap-8">
                <DebateTab bull={d.debate.bull} bear={d.debate.bear} judge={d.debate.judge} />
                <CrossValidationPanel mandateId={m.id} cv={d.crossValidation ? { ...d.crossValidation, createdAt: d.crossValidation.createdAt.toISOString() } : null} />
              </div>
            ) : (
              <Pending stage={STAGE_LABEL.DEBATE} />
            ))}
          {tab === "memo" &&
            (d.memo ? (
              <div>
                <div className="mb-6 flex flex-wrap items-center gap-3">
                  <h2 className="font-display text-card text-navy-900">{d.memo.title}</h2>
                  <MemoStatusPill status={d.memo.status} />
                  <span className="num text-small text-ink-500">
                    v{d.memo.version} · {d.memo.lastEditedBy ?? "Memo agent"}
                    {d.memo.approvedBy && ` · approved by ${d.memo.approvedBy}`}
                  </span>
                  <Link href={`/analyst/memos/${d.memo.id}`} className="ml-auto text-small text-ink-700 hover:text-ink-900">
                    Open in memo workspace
                  </Link>
                </div>
                <MemoEditor
                  key={`${d.memo.id}-${d.memo.version}`}
                  memoId={d.memo.id}
                  version={d.memo.version}
                  readOnly={memoReadOnly}
                  initialHtml={d.memo.contentHtml}
                  flags={factCheck(d)}
                  citations={(d.research?.citations ?? []).map((c) => ({ id: c.id, title: c.title, source: c.source, date: c.accessed }))}
                  dataSources={[
                    { title: "Key metrics", items: d.memo.keyMetrics },
                    ...(d.simulation ? [{ title: "Scenarios", items: d.simulation.scenarios.map((s) => ({ label: `${s.label} IRR`, value: `${s.irr.toFixed(1)}%` })) }] : []),
                    { title: "Asset", items: [{ label: "Price per sq ft", value: `${p.currency} ${Math.round(p.pricePerSqft).toLocaleString("en-US")}` }, { label: "Gross yield", value: `${p.grossYield.toFixed(1)}%` }, { label: "Range", value: `${formatLocal(p.priceMin, p.currency)} to ${formatLocal(p.priceMax, p.currency)}` }] },
                  ]}
                />
              </div>
            ) : (
              <Pending stage={STAGE_LABEL.MEMO} />
            ))}
          {tab === "documents" && (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
              <div className="xl:col-span-8">
                {d.documents.length === 0 ? (
                  <p className="text-small text-ink-500">No documents filed against this mandate.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {d.documents.map((doc) => (
                      <DocumentCard key={doc.id} doc={doc} href={doc.type === "memo" && d.memo && !doc.storagePath && !doc.blobUrl ? `/api/memos/${d.memo.id}/export` : undefined} subtitle={formatDate(doc.createdAt)} />
                    ))}
                  </div>
                )}
              </div>
              <div className="xl:col-span-4">
                <DocumentUpload mandateId={m.id} defaultType="research" types={["research", "spa", "title_deed", "valuation", "statement", "other"]} />
              </div>
            </div>
          )}
          {tab === "actions" && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="eyebrow">Layer 5 · agentic actions</div>
                  <p className="mt-1 max-w-[72ch] text-small text-ink-700">The action agent proposes follow-ups; nothing runs until someone approves it, and every executed action can be reversed.</p>
                </div>
                <ProposeActionDialog mandateId={m.id} clientId={m.clientId} />
              </div>
              <ActionsPanel actions={d.actions.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), executedAt: a.executedAt?.toISOString() ?? null }))} />
            </div>
          )}
          {tab === "audit" && (
            <Card>
              <CardHeader eyebrow="Immutable record" title="Audit trail" />
              <CardContent>
                <ActivityFeed linkMandates={false} items={d.audit.map((a) => ({ ...a, reference: null }))} />
              </CardContent>
            </Card>
          )}
        </div>
      </PageContainer>
    </LiveMandate>
  );
}
