import Link from "next/link";
import { notFound } from "next/navigation";
import { AmlReview, DocStatus, KycDecision } from "@/components/client/kyc-actions";
import { PageHeader } from "@/components/composites/page-header";
import { Flag } from "@/components/os/badges";
import { RunAgent } from "@/components/os/run-agent";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { AML_PROVIDER, latestAml } from "@/lib/client/aml";
import { DOC_LABEL, ensureKyc } from "@/lib/client/kyc";
import { scope } from "@/lib/tenant-db";
import { formatDate } from "@/lib/utils";
import { eq } from "drizzle-orm";

export const metadata = { title: "KYC file" };
export const dynamic = "force-dynamic";

const DOC_TONE = { missing: "neutral", received: "progress", verified: "complete", rejected: "error" } as const;

export default async function KycFile({ params }: { params: Promise<{ client_id: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { client_id: id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [c] = await db.select().from(s.clients).where(scope(s.clients, user.tenantId, eq(s.clients.id, id)));
  if (!c) notFound();
  const k = await ensureKyc(db, user.tenantId, id);
  const { latest, history } = await latestAml(db, user.tenantId, id);
  const [analyzer, screener] = await Promise.all([lastOutput(user.tenantId, "kyc-analyzer", id), lastOutput(user.tenantId, "aml-screener", id)]);
  const init = (x: typeof analyzer) => (x ? { output: x.output as never, model: x.model, costUsd: x.costUsd, at: x.at } : null);
  return (
    <PageContainer>
      <PageHeader eyebrow={<Link href="/admin/kyc">Compliance · KYC</Link>} title={c.name} subtitle={`${c.type} · ${c.nationality} · ${c.residency}`} meta={<><Flag tone={k.status === "verified" ? "complete" : k.status === "rejected" || k.status === "expired" ? "error" : "progress"}>{k.status.replace("_", " ")}</Flag><span>Risk {k.riskLevel}</span>{k.pep && <Flag tone="error">PEP</Flag>}{k.expiresAt && <span>Expires {formatDate(k.expiresAt)}</span>}{k.verifiedBy && <span>Verified by {k.verifiedBy}</span>}</>} />
      <Section title="Required documents" description="Required by residency and nationality. Record expiry dates; the earliest sets the KYC renewal date.">
        <SimpleTable
          rows={k.documents}
          minWidth={820}
          columns={[
            { key: "t", header: "Document", cell: (d) => <span className="text-ink-900">{DOC_LABEL[d.type]}</span> },
            { key: "s", header: "Status", cell: (d) => <Flag tone={DOC_TONE[d.status]}>{d.status}</Flag> },
            { key: "e", header: "Expires", cell: (d) => (d.expiresAt ? formatDate(d.expiresAt) : "None") },
            { key: "x", header: "", cell: (d) => <DocStatus clientId={id} type={d.type} status={d.status} expiresAt={d.expiresAt} /> },
          ]}
        />
      </Section>
      <div className="grid gap-x-8 xl:grid-cols-2">
        <Section title="Assessment" eyebrow="Agent 29 · KYC analyzer">
          <RunAgent endpoint={`/api/kyc/${id}/agent`} body={{ agent: "kyc-analyzer" }} agentLabel="KYC analyzer" initial={init(analyzer)} />
        </Section>
        <Section title="Decision">
          <KycDecision clientId={id} pep={k.pep} sourceOfFunds={k.sourceOfFunds} />
        </Section>
      </div>
      <Section title="Screening" eyebrow={AML_PROVIDER} description="Sanctions, PEP and adverse media. The demonstration provider screens a fictional sample list; connect a licensed provider before production use.">
        <SimpleTable
          rows={latest}
          minWidth={900}
          empty="Not yet screened. Run the screener below."
          columns={[
            { key: "t", header: "Check", cell: (a) => a.type.replace("_", " ") },
            { key: "s", header: "Result", cell: (a) => <Flag tone={a.status === "clear" ? "complete" : a.status === "potential_match" ? "progress" : "error"}>{a.status.replace("_", " ")}</Flag> },
            { key: "f", header: "Alerts", cell: (a) => (a.flags.length ? a.flags.map((f) => `${f.name} (${f.score}, ${f.list}): ${f.note}`).join(" ") : "None") },
            { key: "d", header: "Checked", cell: (a) => formatDate(a.checkedAt) },
            { key: "r", header: "", cell: (a) => (a.status === "potential_match" ? <AmlReview clientId={id} checkId={a.id} /> : a.reviewedBy ? `Reviewed by ${a.reviewedBy}` : null) },
          ]}
        />
        <div className="mt-6">
          <RunAgent endpoint={`/api/kyc/${id}/screen`} body={{}} agentLabel="AML screener" action="Screen now" initial={init(screener)} />
        </div>
        <p className="mt-4 text-axis text-ink-500">{history.length} screening results on file.</p>
      </Section>
    </PageContainer>
  );
}
