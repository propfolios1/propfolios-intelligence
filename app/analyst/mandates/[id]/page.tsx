import { Download, FileText, Printer } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuditList } from "@/components/audit-list";
import { DocumentCard } from "@/components/document-card";
import { EmptyState } from "@/components/empty-state";
import { DDTab } from "@/components/mandate/dd-tab";
import { DebateTab } from "@/components/mandate/debate-tab";
import { OverviewTab } from "@/components/mandate/overview-tab";
import { ResearchTab } from "@/components/mandate/research-tab";
import { RunFlowButton } from "@/components/mandate/run-flow-button";
import { MANDATE_TABS, TabBar, type MandateTab } from "@/components/mandate/tab-bar";
import { UnderwritingTab } from "@/components/mandate/underwriting-tab";
import { MemoEditor } from "@/components/memo-editor";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { getAnalysis, getMandateView, getMemoHtml, listAudit, listDocuments } from "@/lib/data/store";
import { buildMemoDraft } from "@/lib/data/memo";
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
    <PageContainer className="pt-10 md:pt-12">
      <PageHeader
        eyebrow={`${mandate.id} · ${property.community}`}
        title={
          <>
            {client.name}
            <span className="text-ink-400"> — </span>
            {property.name}
          </>
        }
        meta={
          <>
            <StatusPill status={mandate.status} />
            <span>
              Created <span className="num">{formatDate(mandate.createdAt)}</span>
            </span>
            <span>
              Updated <span className="num">{formatDate(mandate.updatedAt, "datetime")}</span>
            </span>
            <span>
              Due <span className="num">{formatDate(mandate.deadline)}</span>
            </span>
            <span>{analyst.name}</span>
            <span className="num">{formatMoney(mandate.ticketSize, "USD")}</span>
          </>
        }
        actions={
          <>
            <RunFlowButton mandateId={mandate.id} />
            <Button asChild variant="secondary">
              <Link href={`/analyst/mandates/${mandate.id}?tab=memo`} scroll={false}>
                <FileText /> Generate Memo
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">
                  <Download /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/analyst/mandates/${mandate.id}?tab=memo`}>
                    <FileText /> Memo (PDF / Word)
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={`/api/mandates/${mandate.id}/export`} download>
                    <Printer /> Analysis (JSON)
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="mt-10">
        <TabBar id={mandate.id} active={tab} />
      </div>

      <div className="pt-10">
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
                  { label: "Client", value: client.name },
                  { label: "Ticket", value: formatMoney(mandate.ticketSize, "USD") },
                  { label: "Hold", value: `${mandate.horizonYears} yrs` },
                ],
              },
              { title: "Underwriting", items: analysis.underwriting.scenarios.map((s) => ({ label: `${s.label} IRR`, value: `${s.irr.toFixed(1)}%` })) },
              {
                title: "Property",
                items: [
                  { label: "Asset", value: property.assetClass },
                  { label: "Status", value: property.status },
                  { label: "Handover", value: property.handover },
                  { label: "Gross yield", value: `${property.grossYield}%` },
                ],
              },
              {
                title: "Developer",
                items: [
                  { label: "Name", value: developer.name },
                  { label: "Risk score", value: `${developer.riskScore}/100` },
                  { label: "On-time", value: `${developer.deliveryPct}%` },
                  { label: "Litigation", value: String(developer.litigationCount) },
                ],
              },
              { title: "Due diligence", items: (["critical", "high", "medium", "low"] as const).map((s) => ({ label: s, value: String(analysis.dd.filter((f) => f.severity === s).length) })) },
            ]}
            citations={analysis.research.citations}
            initialSuggestions={[
              {
                kind: "tighten",
                target: "Subject to client approval, we will issue the conditions to the developer",
                replacement: "On approval, we will issue these conditions to the developer",
                reason: "Shorter, and leads with the action.",
              },
              {
                kind: "add_evidence",
                target: analysis.bull.thesis.slice(0, 60),
                replacement: `${analysis.bull.thesis.slice(0, 60)} [2]`,
                reason: "Claim about supply constraint should cite the market index.",
              },
            ]}
            initialFlags={[
              {
                claim: `${analysis.underwriting.scenarios[1]!.irr.toFixed(1)}%`,
                issue: "calculation",
                severity: "low",
                suggestion: "Matches underwriting P50. Verified.",
              },
              ...(analysis.research.dataGaps.slice(0, 1).map((g) => ({ claim: g, issue: "unsupported", severity: "medium" as const, suggestion: "Disclose as a data gap in the memo." })) ?? []),
            ]}
          />
        )}
        {tab === "documents" &&
          (() => {
            const docs = listDocuments().filter((d) => d.mandateId === mandate.id);
            return docs.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                {docs.map((d) => (
                  <DocumentCard key={d.id} doc={d} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={FileText}
                headline="No documents yet"
                subtext="Upload the SPA, title deed or valuation and the DD agent will read them."
                action={<Button variant="secondary">Upload document</Button>}
              />
            );
          })()}
        {tab === "audit" && <AuditList events={listAudit({ mandateId: mandate.id })} />}
      </div>
    </PageContainer>
  );
}
