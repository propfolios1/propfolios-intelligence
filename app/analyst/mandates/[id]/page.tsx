import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditList } from "@/components/composites/audit-list";
import { DocumentCard } from "@/components/composites/document-card";
import { EmptyState } from "@/components/composites/empty-state";
import { DDTab } from "@/components/composites/mandate/dd-tab";
import { DebateTab } from "@/components/composites/mandate/debate-tab";
import { OverviewTab } from "@/components/composites/mandate/overview-tab";
import { ResearchTab } from "@/components/composites/mandate/research-tab";
import { RunFlowButton } from "@/components/composites/mandate/run-flow-button";
import { MANDATE_TABS, TabBar, type MandateTab } from "@/components/composites/mandate/tab-bar";
import { UnderwritingTab } from "@/components/composites/mandate/underwriting-tab";
import { MemoEditor } from "@/components/composites/memo-editor";
import { StatusPillFor } from "@/components/composites/status";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PageContainer } from "@/components/shell/page-container";
import { buildMemoDraft } from "@/lib/data/memo";
import { getAnalysis, getMandateView, getMemoHtml, listAudit, listDocuments } from "@/lib/data/store";
import { formatDate, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: id };
}

export default async function MandateDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const view = getMandateView(id);
  const analysis = getAnalysis(id);
  if (!view || !analysis) notFound();
  const tab = (MANDATE_TABS.some(([k]) => k === rawTab) ? rawTab : "overview") as MandateTab;
  const { mandate, client, property, developer, analyst } = view;

  return (
    <PageContainer className="pb-32">
      <header>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <CopyButton value={mandate.id} label={`Copy ${mandate.id}`} className="num text-small text-ink-700">
            {mandate.id}
          </CopyButton>
          <span className="eyebrow">{property.community}</span>
          <StatusPillFor status={mandate.status} />
        </div>
        <div className="mt-6 flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
          <h1 className="max-w-[22ch] font-display text-section text-navy-900 md:text-title">
            {property.name}
            <span className="block text-ink-500">for {client.name}</span>
          </h1>
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            <RunFlowButton mandateId={mandate.id} />
            <Button asChild variant="secondary">
              <Link href={`/analyst/mandates/${mandate.id}?tab=memo`} scroll={false}>
                Generate memo
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost">Export ▾</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/analyst/mandates/${mandate.id}?tab=memo`}>Memo as PDF or Word</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/mandates/${mandate.id}/export`} download>
                    Analysis as JSON
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <dl className="mt-10 grid grid-cols-2 border-t border-ink-200 md:grid-cols-6">
          {[
            ["Ticket", formatMoney(mandate.ticketSize, "USD"), true],
            ["Hold", `${mandate.horizonYears} years`, true],
            ["Developer", developer.name, false],
            ["Analyst", analyst.name, false],
            ["Opened", formatDate(mandate.createdAt), true],
            ["Due", formatDate(mandate.deadline), true],
          ].map(([k, v, mono]) => (
            <div key={String(k)} className="border-b border-ink-200 py-3 pr-4">
              <dt className="text-small text-ink-500">{k}</dt>
              <dd className={mono ? "num mt-0.5 text-ui text-ink-900" : "mt-0.5 truncate text-ui text-ink-900"}>{v}</dd>
            </div>
          ))}
        </dl>
      </header>

      <div className="mt-12">
        <TabBar id={mandate.id} active={tab} />
      </div>

      <div className="pt-14">
        {tab === "overview" && <OverviewTab analysis={analysis} mandate={mandate} />}
        {tab === "research" && <ResearchTab research={analysis.research} />}
        {tab === "underwriting" && <UnderwritingTab uw={analysis.underwriting} />}
        {tab === "dd" && <DDTab findings={analysis.dd} />}
        {tab === "debate" && <DebateTab bull={analysis.bull} bear={analysis.bear} judge={analysis.judge} />}
        {tab === "memo" && (
          <MemoEditor
            mandateId={mandate.id}
            initialHtml={
              getMemoHtml(mandate.id) ??
              buildMemoDraft({
                analysis,
                clientName: client.name,
                propertyName: property.name,
                developerName: developer.name,
                community: property.community,
                ticketSize: mandate.ticketSize,
                horizonYears: mandate.horizonYears,
              })
            }
            dataSources={[
              {
                title: "Mandate",
                items: [
                  { label: "Ticket", value: formatMoney(mandate.ticketSize, "USD") },
                  { label: "Hold", value: `${mandate.horizonYears} yrs` },
                ],
              },
              { title: "Returns", items: analysis.underwriting.scenarios.map((s) => ({ label: `${s.label} IRR`, value: `${s.irr.toFixed(1)}%` })) },
              {
                title: "Asset",
                items: [
                  { label: "Status", value: property.status },
                  { label: "Handover", value: property.handover },
                  { label: "Yield", value: `${property.grossYield}%` },
                ],
              },
              {
                title: "Developer",
                items: [
                  { label: "Risk", value: `${developer.riskScore}/100` },
                  { label: "On time", value: `${developer.deliveryPct}%` },
                  { label: "Litigation", value: String(developer.litigationCount) },
                ],
              },
              { title: "Diligence", items: (["critical", "high", "medium", "low"] as const).map((s) => ({ label: s.charAt(0).toUpperCase() + s.slice(1), value: String(analysis.dd.filter((f) => f.severity === s).length) })) },
            ]}
            citations={analysis.research.citations}
            initialSuggestions={[
              {
                kind: "tighten",
                target: "Subject to client approval, the conditions will be issued to the developer",
                replacement: "On approval, the conditions go to the developer",
                reason: "Shorter. Leads with the action.",
              },
              {
                kind: "add_evidence",
                target: analysis.bull.thesis.split(";")[0]!,
                replacement: `${analysis.bull.thesis.split(";")[0]} [2]`,
                reason: "The supply claim should cite the prime index.",
              },
            ]}
            initialFlags={[
              { claim: `${analysis.underwriting.scenarios[1]!.irr.toFixed(1)}%`, issue: "calculation", severity: "low", suggestion: "Matches the P50 underwriting." },
              ...analysis.research.dataGaps.slice(0, 1).map((g) => ({ claim: g, issue: "unsupported", severity: "medium" as const, suggestion: "Disclose as a data gap." })),
            ]}
          />
        )}
        {tab === "documents" &&
          (() => {
            const docs = listDocuments().filter((d) => d.mandateId === mandate.id);
            return docs.length ? (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {docs.map((d) => (
                  <DocumentCard key={d.id} doc={d} />
                ))}
              </div>
            ) : (
              <EmptyState glyph="documents" headline="No documents on this mandate yet." note="The SPA, title deed and valuation go here. The diligence agent reads them." action={<Button variant="secondary">Upload</Button>} />
            );
          })()}
        {tab === "audit" && <AuditList events={listAudit({ mandateId: mandate.id })} />}
      </div>
    </PageContainer>
  );
}
