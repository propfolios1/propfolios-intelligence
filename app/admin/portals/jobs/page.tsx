import { PageHeader } from "@/components/composites/page-header";
import { PortalStatus, RetryJob } from "@/components/portals/portals";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { PORTAL_SPECS } from "@/lib/portals/specs";
import { portalCards } from "@/lib/portals/view";

export const metadata = { title: "Publish queue" };
export const dynamic = "force-dynamic";

const at = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");

export default async function PortalJobsPage() {
  const user = await requireRole(["tenant_admin"]);
  const { jobs } = await portalCards(await getDb(), user.tenantId);
  const open = jobs.filter((j) => j.j.status === "queued" || j.j.status === "running" || j.j.status === "failed");
  return (
    <PageContainer>
      <PageHeader eyebrow="Portals" title="Publish queue" subtitle="Every publish, update and removal sent to a portal. Failed jobs retry automatically with growing intervals, up to five attempts; credential and validation errors stop at once and can be retried after correction." />
      <Section title="Needs attention or waiting" description={`${open.length} jobs`}>
        <SimpleTable
          rows={open}
          minWidth={1000}
          empty="The queue is clear."
          columns={[
            { key: "l", header: "Listing", cell: (r) => `${r.reference} · ${r.title}` },
            { key: "p", header: "Portal", cell: (r) => PORTAL_SPECS[r.portal]?.name ?? r.portal },
            { key: "a", header: "Action", cell: (r) => r.j.action },
            { key: "s", header: "Status", cell: (r) => <PortalStatus status={r.j.status} /> },
            { key: "n", header: "Attempts", numeric: true, cell: (r) => r.j.attempts },
            { key: "t", header: "Next attempt", cell: (r) => (r.j.status === "queued" ? `${at(r.j.nextAttemptAt)} UTC` : "") },
            { key: "e", header: "Last error", cell: (r) => <span className="text-danger">{r.j.errors.at(-1)?.message ?? ""}</span> },
            { key: "r", header: "", cell: (r) => (r.j.status === "failed" ? <RetryJob id={r.j.id} /> : null) },
          ]}
        />
      </Section>
      <Section title="History">
        <SimpleTable
          rows={jobs.filter((j) => j.j.status === "succeeded").slice(0, 100)}
          minWidth={820}
          empty="No completed jobs yet."
          columns={[
            { key: "l", header: "Listing", cell: (r) => `${r.reference} · ${r.title}` },
            { key: "p", header: "Portal", cell: (r) => PORTAL_SPECS[r.portal]?.name ?? r.portal },
            { key: "a", header: "Action", cell: (r) => r.j.action },
            { key: "b", header: "By", cell: (r) => r.j.requestedBy ?? "Scheduler" },
            { key: "f", header: "Finished", cell: (r) => `${at(r.j.finishedAt)} UTC` },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
