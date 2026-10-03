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
import { CRZ_RULES, RP2021_ZONES } from "@/lib/regulations";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Goa" };
export const dynamic = "force-dynamic";

const TABS = [
  ["projects", "Projects"],
  ["land-use", "Land use and conversion"],
  ["coastal", "CRZ"],
  ["comunidade", "Comunidade and mundkar"],
  ["land", "Land records"],
  ["rera", "Goa RERA"],
] as const;

const link = (id: string, name: string) => (
  <Link href={`/analyst/india/records/${id}`} className="font-medium text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
    {name}
  </Link>
);

export default async function GoaPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const tab = activeTab(TABS, (await searchParams).tab);
  const db = await getDb();
  const [rows, complaints, land] = await Promise.all([listIndiaProperties(db, user.tenantId, "GA"), complaintsFor(db, user.tenantId, "Goa RERA"), landRecordsFor(db, user.tenantId, "GA")]);
  const conditioned = rows.filter((r) => r.record.conversionStatus === "applied" || r.record.conversionStatus === "required" || r.record.mundkarStatus === "claimed" || r.record.mundkarStatus === "declared" || r.record.crzZone === "CRZ-III");
  return (
    <PageContainer>
      <PageHeader eyebrow="India · Goa" title="Goa desk" subtitle="Villas and holiday homes from Sun Estates, Acron, Veera and Empire, read against Goa RERA, the Regional Plan 2021, CRZ, Comunidade grants, the mundkar register and Form I and XIV." />
      <section className="my-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Projects" value={String(rows.length)} note={`${rows.filter((r) => r.property.assetClass === "Villa").length} villa communities`} />
        <StatCard label="With land conditions" value={String(conditioned.length)} note="Conversion, mundkar or CRZ-III" />
        <StatCard label="Comunidade origin" value={String(rows.filter((r) => r.record.comunidade).length)} note="Aforamento title" />
        <StatCard label="Median gross yield" value={(() => { const v = rows.map((r) => r.property.grossYield).sort((a, b) => a - b); return v.length ? `${v[Math.floor(v.length / 2)]!.toFixed(1)}%` : "None"; })()} note="Before management fees" />
      </section>
      <SectionTabs base="/analyst/india/goa" tabs={TABS} active={tab} label="Goa sections" />

      {tab === "projects" && (
        <Section title="Projects">
          <SimpleTable
            rows={rows}
            minWidth={980}
            columns={[
              { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
              { key: "d", header: "Developer", cell: (r) => r.developer.name },
              { key: "v", header: "Village", cell: (r) => `${r.record.village}, ${r.record.district}` },
              { key: "z", header: "RP 2021", cell: (r) => r.record.rp2021Zone },
              { key: "s", header: "Goa RERA", cell: (r) => <ReraStatus status={r.record.reraStatus} /> },
              { key: "p", header: "From", numeric: true, cell: (r) => formatInr(r.property.priceMin) },
              { key: "y", header: "Gross yield", numeric: true, cell: (r) => `${r.property.grossYield.toFixed(1)}%` },
            ]}
          />
        </Section>
      )}

      {tab === "land-use" && (
        <Section title="Land use and conversion" description="Only settlement and commercial zones are buildable for housing. Conversion under s.32 of the Land Revenue Code typically takes six months.">
          <SimpleTable
            rows={rows}
            minWidth={980}
            columns={[
              { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
              { key: "sv", header: "Survey", cell: (r) => <span className="num">{r.record.surveyNumber}/{r.record.subDivision}</span> },
              { key: "z", header: "Zone", cell: (r) => r.record.rp2021Zone },
              { key: "b", header: "Buildable", cell: (r) => (r.record.landUse && RP2021_ZONES[r.record.landUse].buildable ? <Flag tone="complete">Yes</Flag> : <Flag tone="error">Restricted</Flag>) },
              { key: "c", header: "Conversion", cell: (r) => <Flag tone={r.record.conversionStatus === "applied" || r.record.conversionStatus === "required" ? "progress" : "complete"}>{r.record.conversionStatus?.replace("_", " ") ?? "None"}</Flag> },
              { key: "days", header: "Days elapsed", numeric: true, cell: (r) => r.record.conversionDays ?? "None" },
            ]}
          />
        </Section>
      )}

      {tab === "coastal" && (
        <Section title="Coastal Regulation Zone" description="CRZ Notification 2019 as mapped in the Goa Coastal Zone Management Plan.">
          <SimpleTable
            rows={rows}
            columns={[
              { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
              { key: "v", header: "Village", cell: (r) => r.record.village },
              { key: "z", header: "CRZ", cell: (r) => <Flag tone={r.record.crzZone === "none" || r.record.crzZone === "CRZ-II" ? "complete" : "error"}>{r.record.crzZone === "none" ? "Outside" : (r.record.crzZone ?? "None")}</Flag> },
              { key: "note", header: "Rule", cell: (r) => (r.record.crzZone ? CRZ_RULES[r.record.crzZone].note : "Not classified") },
            ]}
          />
        </Section>
      )}

      {tab === "comunidade" && (
        <Section title="Comunidade and mundkar" description="Aforamento grants need the Comunidade's consent to transfer; a mundkar's dwelling right survives a sale.">
          <SimpleTable
            rows={rows}
            minWidth={900}
            columns={[
              { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
              { key: "c", header: "Comunidade", cell: (r) => (r.record.comunidade ? `Comunidade de ${r.record.comunidadeName}` : "Private title") },
              { key: "m", header: "Mundkar", cell: (r) => <Flag tone={r.record.mundkarStatus === "claimed" || r.record.mundkarStatus === "declared" ? "error" : "complete"}>{r.record.mundkarStatus ?? "none"}</Flag> },
              { key: "t", header: "Root of title", cell: (r) => { const h = r.record.titleHistory[0]; return h ? `${h.document} (${h.year})` : "Not on file"; } },
            ]}
          />
        </Section>
      )}

      {tab === "land" && (
        <Section title="Land records" description="Form I and XIV and Comunidade grants parsed by the Goa parsers.">
          <SimpleTable
            rows={land}
            minWidth={900}
            columns={[
              { key: "p", header: "Property", cell: (r) => link(r.propertyId, r.property) },
              { key: "t", header: "Record", cell: (r) => RECORD_LABEL[r.land.recordType as keyof typeof RECORD_LABEL] ?? r.land.recordType },
              { key: "c", header: "Confidence", numeric: true, cell: (r) => `${Math.round(r.land.confidence * 100)}%` },
              { key: "w", header: "Findings", cell: (r) => (r.land.warnings.length ? r.land.warnings.slice(0, 2).join(" ") : <Flag tone="complete">Clear</Flag>) },
            ]}
          />
        </Section>
      )}

      {tab === "rera" && (
        <Section title="Goa RERA" description="Registrations and complaints against the Goa promoters.">
          <SimpleTable
            rows={rows}
            columns={[
              { key: "n", header: "Project", cell: (r) => link(r.property.id, r.property.name) },
              { key: "r", header: "Registration", cell: (r) => <span className="num">{r.record.reraNumber}</span> },
              { key: "s", header: "Status", cell: (r) => <ReraStatus status={r.record.reraStatus} /> },
              { key: "v", header: "Valid until", cell: (r) => (r.record.reraValidUntil ? formatDate(r.record.reraValidUntil) : "None") },
            ]}
          />
          <div className="mt-6" />
          <SimpleTable
            rows={complaints}
            minWidth={900}
            columns={[
              { key: "n", header: "Complaint", cell: (c) => <span className="num">{c.complaint.complaintNumber}</span> },
              { key: "d", header: "Developer", cell: (c) => c.developer },
              { key: "c", header: "Category", cell: (c) => c.complaint.category },
              { key: "s", header: "Status", cell: (c) => <ComplaintStatus status={c.complaint.status} /> },
              { key: "o", header: "Outcome", cell: (c) => c.complaint.outcome ?? c.complaint.reliefSought },
            ]}
          />
        </Section>
      )}
    </PageContainer>
  );
}
