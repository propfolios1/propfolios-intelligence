import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { ComplaintStatus, Flag, ReraStatus } from "@/components/os/badges";
import { activeTab, SectionTabs } from "@/components/os/section-tabs";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatInr } from "@/lib/format";
import { complaintsFor, landRecordsFor, listIndiaProperties } from "@/lib/india/context";
import { RECORD_LABEL } from "@/lib/india/parsers";
import { READY_RECKONER, READY_RECKONER_YEAR } from "@/lib/india/ready-reckoner";
import { dcprCheck } from "@/lib/regulations";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Mumbai" };
export const dynamic = "force-dynamic";

const TABS = [
  ["projects", "Projects"],
  ["maharera", "MahaRERA"],
  ["ready-reckoner", "Ready Reckoner"],
  ["land", "Land records"],
  ["approvals", "MCGM approvals"],
  ["redevelopment", "Redevelopment and DCPR"],
] as const;

const link = (id: string, name: string) => (
  <Link href={`/analyst/india/records/${id}`} className="font-medium text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
    {name}
  </Link>
);

export default async function MumbaiPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const tab = activeTab(TABS, (await searchParams).tab);
  const db = await getDb();
  const [rows, complaints, land] = await Promise.all([listIndiaProperties(db, user.tenantId, "MH"), complaintsFor(db, user.tenantId, "MahaRERA"), landRecordsFor(db, user.tenantId, "MH")]);
  const ratio = (r: (typeof rows)[number]) => (r.record.readyReckonerRate ? (r.property.pricePerSqft * 10.764) / r.record.readyReckonerRate : null);
  const open = complaints.filter((c) => !["disposed", "withdrawn"].includes(c.complaint.status));
  const noOc = rows.filter((r) => r.property.status === "ready" && !r.record.mcgmApprovals?.oc);
  return (
    <PageContainer>
      <PageHeader eyebrow="India · Maharashtra" title="Mumbai desk" subtitle="Fifteen Mumbai projects across five developers, read against MahaRERA, IGR, the Ready Reckoner, City Survey and 7/12 records, MCGM approvals and DCPR 2034." />
      <section className="my-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Projects" value={String(rows.length)} note={`${rows.filter((r) => r.property.status !== "ready").length} under construction`} />
        <StatCard label="Extended registrations" value={String(rows.filter((r) => r.record.reraStatus === "extended").length)} note="s.6 extensions" />
        <StatCard label="Open complaints" value={String(open.length)} note={`${complaints.length} before MahaRERA`} />
        <StatCard label="Median asking / Ready Reckoner" value={(() => { const v = rows.map(ratio).filter((x): x is number => x !== null).sort((a, b) => a - b); return v.length ? `${v[Math.floor(v.length / 2)]!.toFixed(2)}x` : "None"; })()} note={`${READY_RECKONER_YEAR}-${String(READY_RECKONER_YEAR + 1).slice(2)} rates`} />
      </section>
      <SectionTabs base="/analyst/india/mumbai" tabs={TABS} active={tab} label="Mumbai sections" />

      {tab === "projects" && (
        <Section title="Projects" description="Select a project for the full register file, the compliance agent and the transaction cost quote.">
          <SimpleTable
            rows={rows}
            minWidth={980}
            columns={[
              { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
              { key: "d", header: "Developer", cell: (r) => r.developer.name },
              { key: "l", header: "Locality", cell: (r) => r.property.community },
              { key: "s", header: "MahaRERA", cell: (r) => <ReraStatus status={r.record.reraStatus} /> },
              { key: "p", header: "From", numeric: true, cell: (r) => formatInr(r.property.priceMin) },
              { key: "psf", header: "₹ / sq ft", numeric: true, cell: (r) => r.property.pricePerSqft.toLocaleString("en-IN") },
              { key: "rr", header: "× Ready Reckoner", numeric: true, cell: (r) => (ratio(r) ? `${ratio(r)!.toFixed(2)}x` : "None") },
              { key: "y", header: "Gross yield", numeric: true, cell: (r) => `${r.property.grossYield.toFixed(1)}%` },
            ]}
          />
        </Section>
      )}

      {tab === "maharera" && (
        <>
          <Section title="Registrations" description="Validity is read against the promised possession date; an extension under s.6 signals a delay already incurred.">
            <SimpleTable
              rows={rows}
              columns={[
                { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
                { key: "r", header: "Registration", cell: (r) => <span className="num">{r.record.reraNumber}</span> },
                { key: "s", header: "Status", cell: (r) => <ReraStatus status={r.record.reraStatus} /> },
                { key: "v", header: "Valid until", cell: (r) => (r.record.reraValidUntil ? formatDate(r.record.reraValidUntil) : "None") },
                { key: "h", header: "Possession", cell: (r) => r.property.handover },
              ]}
            />
          </Section>
          <Section title="Complaints" description="Complaints and orders against the promoters, from the MahaRERA cause list.">
            <SimpleTable
              rows={complaints}
              minWidth={980}
              columns={[
                { key: "n", header: "Complaint", cell: (c) => <span className="num">{c.complaint.complaintNumber}</span> },
                { key: "d", header: "Developer", cell: (c) => c.developer },
                { key: "p", header: "Project", cell: (c) => c.property ?? "Promoter-level" },
                { key: "c", header: "Category", cell: (c) => c.complaint.category },
                { key: "f", header: "Filed", cell: (c) => formatDate(c.complaint.filedOn) },
                { key: "s", header: "Status", cell: (c) => <ComplaintStatus status={c.complaint.status} /> },
                { key: "o", header: "Outcome", cell: (c) => c.complaint.outcome ?? c.complaint.reliefSought },
                { key: "a", header: "Amount", numeric: true, cell: (c) => (c.complaint.amountInr ? formatInr(c.complaint.amountInr) : "None") },
              ]}
            />
          </Section>
        </>
      )}

      {tab === "ready-reckoner" && (
        <>
          <Section title={`Annual Statement of Rates ${READY_RECKONER_YEAR}-${String(READY_RECKONER_YEAR + 1).slice(2)}`} description="Residential, commercial and open land rates per square metre for the zones in the catalogue. Stamp duty is charged on the higher of the agreement value and the Ready Reckoner value.">
            <SimpleTable
              rows={READY_RECKONER}
              columns={[
                { key: "z", header: "Zone", cell: (z) => <span className="num">{z.zone}</span> },
                { key: "l", header: "Locality", cell: (z) => z.locality },
                { key: "r", header: "Residential", numeric: true, cell: (z) => formatInr(z.residentialPerSqm, { compact: false }) },
                { key: "c", header: "Commercial", numeric: true, cell: (z) => formatInr(z.commercialPerSqm, { compact: false }) },
                { key: "o", header: "Land", numeric: true, cell: (z) => formatInr(z.landPerSqm, { compact: false }) },
              ]}
            />
          </Section>
          <Section title="Asking price against the Ready Reckoner" description="Below 1.1x, the government value approaches the price and s.50C or s.56(2)(x) exposure must be checked on any discount.">
            <SimpleTable
              rows={rows}
              columns={[
                { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
                { key: "z", header: "Zone", cell: (r) => r.record.readyReckonerZone },
                { key: "rr", header: "RR per sq m", numeric: true, cell: (r) => (r.record.readyReckonerRate ? formatInr(r.record.readyReckonerRate, { compact: false }) : "None") },
                { key: "ask", header: "Asking per sq m", numeric: true, cell: (r) => formatInr(r.property.pricePerSqft * 10.764, { compact: false }) },
                { key: "x", header: "Multiple", numeric: true, cell: (r) => (ratio(r) ? <span className={ratio(r)! < 1.1 ? "text-warning" : undefined}>{ratio(r)!.toFixed(2)}x</span> : "None") },
              ]}
            />
          </Section>
        </>
      )}

      {tab === "land" && (
        <Section title="Land records" description="7/12 extracts and property cards parsed by the bilingual parsers. Upload further records from a project's file.">
          <SimpleTable
            rows={land}
            minWidth={900}
            columns={[
              { key: "p", header: "Property", cell: (r) => link(r.propertyId, r.property) },
              { key: "t", header: "Record", cell: (r) => RECORD_LABEL[r.land.recordType as keyof typeof RECORD_LABEL] ?? r.land.recordType },
              { key: "id", header: "Survey / CTS", cell: (r) => <span className="num">{String(r.land.parsed.surveyNumber ?? r.land.parsed.ctsNumber ?? "None")}</span> },
              { key: "c", header: "Confidence", numeric: true, cell: (r) => `${Math.round(r.land.confidence * 100)}%` },
              { key: "w", header: "Findings", cell: (r) => (r.land.warnings.length ? r.land.warnings.slice(0, 2).join(" ") : <Flag tone="complete">Clear</Flag>) },
            ]}
          />
        </Section>
      )}

      {tab === "approvals" && (
        <Section title="MCGM building approvals" description={noOc.length ? `${noOc.length} completed buildings without an occupation certificate on record.` : "Every completed building in the catalogue has an occupation certificate on record."}>
          <SimpleTable
            rows={rows}
            columns={[
              { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
              { key: "i", header: "IOD", cell: (r) => <span className="num">{r.record.mcgmApprovals?.iod ?? "None"}</span> },
              { key: "c", header: "CC", cell: (r) => <span className="num">{r.record.mcgmApprovals?.cc ?? "None"}</span> },
              { key: "o", header: "OC", cell: (r) => (r.record.mcgmApprovals?.oc ? <span className="num">{r.record.mcgmApprovals.oc}</span> : <Flag tone={r.property.status === "ready" ? "error" : "progress"}>{r.property.status === "ready" ? "Missing" : "Pending"}</Flag>) },
              { key: "f", header: "Fire NOC", cell: (r) => <span className="num">{r.record.mcgmApprovals?.fireNoc ?? "None"}</span> },
              { key: "s", header: "Society NOC", cell: (r) => (r.record.societyName ? <Flag tone={r.record.societyNocStatus === "issued" ? "complete" : r.record.societyNocStatus === "refused" ? "error" : "progress"}>{r.record.societyNocStatus ?? "pending"}</Flag> : "Promoter sale") },
            ]}
          />
        </Section>
      )}

      {tab === "redevelopment" && (
        <Section title="Redevelopment and DCPR 2034" description="Indicative permissible FSI by road width under Regulation 30, the FSI consumed, and the headroom that signals redevelopment optionality.">
          <SimpleTable
            rows={rows.filter((r) => r.record.dcpr)}
            minWidth={980}
            columns={[
              { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
              { key: "s", header: "Scheme", cell: (r) => r.record.redevelopmentScheme ?? "None" },
              { key: "z", header: "Zone", cell: (r) => r.record.dcpr!.zone },
              { key: "rw", header: "Road (m)", numeric: true, cell: (r) => r.record.dcpr!.roadWidthM },
              { key: "pf", header: "Permissible FSI", numeric: true, cell: (r) => dcprCheck(r.record.dcpr!).permissibleFsi.toFixed(2) },
              { key: "cf", header: "Consumed", numeric: true, cell: (r) => r.record.dcpr!.fsiConsumed.toFixed(2) },
              { key: "h", header: "Headroom", numeric: true, cell: (r) => dcprCheck(r.record.dcpr!).headroom.toFixed(2) },
              { key: "f", header: "Note", cell: (r) => dcprCheck(r.record.dcpr!).flags[0] ?? "Within permissible FSI." },
            ]}
          />
        </Section>
      )}
    </PageContainer>
  );
}
