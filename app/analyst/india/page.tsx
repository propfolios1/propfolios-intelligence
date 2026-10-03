import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { complaintsFor, landRecordsFor, listIndiaProperties } from "@/lib/india/context";
import { RECORD_LABEL } from "@/lib/india/parsers";
import { SOURCES } from "@/lib/india/sources";
import { GOA_RATES, MH_RATES } from "@/lib/regulations";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "India" };
export const dynamic = "force-dynamic";

export default async function IndiaPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [mh, ga, complaints, land] = await Promise.all([listIndiaProperties(db, user.tenantId, "MH"), listIndiaProperties(db, user.tenantId, "GA"), complaintsFor(db, user.tenantId), landRecordsFor(db, user.tenantId)]);
  const open = complaints.filter((c) => !["disposed", "withdrawn"].includes(c.complaint.status)).length;
  const flagged = land.filter((l) => l.land.warnings.length > 0).length;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="India"
        title="Mumbai and Goa"
        subtitle="Registers, land records and the rules engine for Maharashtra and Goa. Every figure the agents use is computed by the engine from dated rates, and every register extract names its source."
        actions={
          <Link href="/analyst/india/tax-calculator" className="inline-flex h-9 items-center rounded-sm bg-navy-900 px-4 text-ui text-surface hover:bg-navy-800">
            Tax calculator
          </Link>
        }
      />
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Mumbai projects" value={String(mh.length)} note={`${mh.filter((r) => r.record.reraStatus === "extended").length} with extended registration`} href="/analyst/india/mumbai" />
        <StatCard label="Goa projects" value={String(ga.length)} note={`${ga.filter((r) => r.record.mundkarStatus === "claimed" || r.record.conversionStatus === "applied").length} with land conditions`} href="/analyst/india/goa" />
        <StatCard label="Open RERA complaints" value={String(open)} note={`${complaints.length} on file`} />
        <StatCard label="Land records parsed" value={String(land.length)} note={`${flagged} with findings`} />
      </section>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        <Link href="/analyst/india/mumbai" className="rounded-md border border-hairline bg-surface p-6 shadow-card transition-[border-color] duration-150 hover:border-ink-400">
          <div className="eyebrow">Maharashtra</div>
          <div className="mt-3 font-display text-section text-navy-900">Mumbai desk</div>
          <p className="mt-2 text-small text-ink-700">MahaRERA, IGR Index II, Ready Reckoner, 7/12 and property cards, MCGM approvals, MHADA and SRA, DCPR 2034.</p>
          <div className="num mt-4 text-small text-ink-500">Stamp duty {MH_RATES.mumbaiStampPct + MH_RATES.mumbaiMetroCessPct}% · registration {MH_RATES.registrationPct}% capped at ₹{MH_RATES.registrationCapInr.toLocaleString("en-IN")}</div>
        </Link>
        <Link href="/analyst/india/goa" className="rounded-md border border-hairline bg-surface p-6 shadow-card transition-[border-color] duration-150 hover:border-ink-400">
          <div className="eyebrow">Goa</div>
          <div className="mt-3 font-display text-section text-navy-900">Goa desk</div>
          <p className="mt-2 text-small text-ink-700">Goa RERA, Regional Plan 2021, conversion sanads, CRZ, Comunidade aforamentos, mundkars, Form I and XIV, Escrituras.</p>
          <div className="num mt-4 text-small text-ink-500">Stamp duty {GOA_RATES.stampStandardPct}% ({GOA_RATES.stampWomenPct}% women) · registration {GOA_RATES.registrationPct}%</div>
        </Link>
      </div>

      <Section title="Data sources" eyebrow="Registers" description="None of these registers publishes an API. Each adapter reads the workspace's records in the register's shape; a licensed feed replaces an adapter without changing the agents or pages.">
        <SimpleTable
          rows={Object.values(SOURCES)}
          columns={[
            { key: "label", header: "Source", cell: (s) => <span className="font-medium text-ink-900">{s.label}</span> },
            { key: "state", header: "State", cell: (s) => (s.state === "MH" ? "Maharashtra" : "Goa") },
            { key: "auth", header: "Authority", cell: (s) => s.authority },
            { key: "covers", header: "Covers", cell: (s) => s.covers },
            { key: "mode", header: "Mode", cell: () => <Flag tone="neutral">Mocked</Flag> },
          ]}
          minWidth={900}
        />
      </Section>

      <Section title="Recent land records" eyebrow="Parsers" description="7/12 extracts, property cards, Form I and XIV and Comunidade grants parsed from uploads, including Marathi and Portuguese text.">
        <SimpleTable
          rows={land.slice(0, 10)}
          columns={[
            { key: "p", header: "Property", cell: (r) => <Link className="text-navy-900 underline decoration-ink-200 underline-offset-4" href={`/analyst/india/records/${r.propertyId}`}>{r.property}</Link> },
            { key: "t", header: "Record", cell: (r) => RECORD_LABEL[r.land.recordType as keyof typeof RECORD_LABEL] ?? r.land.recordType },
            { key: "c", header: "Confidence", numeric: true, cell: (r) => `${Math.round(r.land.confidence * 100)}%` },
            { key: "w", header: "Findings", cell: (r) => (r.land.warnings.length ? <Flag tone="progress">{r.land.warnings.length} findings</Flag> : <Flag tone="complete">Clear</Flag>) },
            { key: "d", header: "Filed", cell: (r) => formatDate(r.land.createdAt) },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
