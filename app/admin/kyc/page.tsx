import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ensureKyc, listKyc } from "@/lib/client/kyc";
import { scope } from "@/lib/tenant-db";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "KYC" };
export const dynamic = "force-dynamic";

const KYC_TONE = { not_started: "neutral", pending: "progress", in_review: "progress", verified: "complete", rejected: "error", expired: "error" } as const;

export default async function KycList() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const clients = await db.select({ id: s.clients.id }).from(s.clients).where(scope(s.clients, user.tenantId));
  for (const c of clients) await ensureKyc(db, user.tenantId, c.id);
  const rows = await listKyc(db, user.tenantId);
  const aml = await db.select().from(s.amlChecks).where(scope(s.amlChecks, user.tenantId));
  const alerts = (clientId: string) => aml.filter((a) => a.clientId === clientId && (a.status === "potential_match" || a.status === "confirmed_match")).length;
  const soon = rows.filter((r) => r.kyc.expiresAt && r.kyc.expiresAt.getTime() - Date.now() < 60 * 86_400_000);
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Compliance" title="Know your customer" subtitle="Customer due diligence under the UAE AML regime and India's KYC norms: required documents by residency, source of funds, risk rating, screening and expiry. Transactions are blocked while KYC is not verified." />
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Verified" value={`${rows.filter((r) => r.kyc.status === "verified").length} of ${rows.length}`} />
        <StatCard label="Outstanding" value={String(rows.filter((r) => r.kyc.status !== "verified").length)} />
        <StatCard label="Expiring within 60 days" value={String(soon.length)} />
        <StatCard label="Open screening alerts" value={String(aml.filter((a) => a.status === "potential_match").length)} />
      </section>
      <Section title="Clients">
        <SimpleTable
          rows={rows}
          minWidth={900}
          columns={[
            { key: "n", header: "Client", cell: (r) => <Link href={`/admin/kyc/${r.client.id}`} className="font-medium text-navy-900 underline decoration-ink-200 underline-offset-4">{r.client.name}</Link> },
            { key: "res", header: "Residency", cell: (r) => r.client.residency },
            { key: "s", header: "Status", cell: (r) => <Flag tone={KYC_TONE[r.kyc.status]}>{r.kyc.status.replace("_", " ")}</Flag> },
            { key: "d", header: "Documents", numeric: true, cell: (r) => `${r.kyc.documents.filter((d) => d.status === "verified").length} / ${r.kyc.documents.length}` },
            { key: "r", header: "Risk", cell: (r) => <Flag tone={r.kyc.riskLevel === "high" ? "error" : r.kyc.riskLevel === "medium" ? "progress" : "complete"}>{r.kyc.riskLevel}</Flag> },
            { key: "a", header: "Screening", cell: (r) => (alerts(r.client.id) ? <Flag tone="error">{alerts(r.client.id)} alerts</Flag> : aml.some((a) => a.clientId === r.client.id) ? <Flag tone="complete">Clear</Flag> : "Not screened") },
            { key: "e", header: "Expires", cell: (r) => (r.kyc.expiresAt ? formatDate(r.kyc.expiresAt) : "None") },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
