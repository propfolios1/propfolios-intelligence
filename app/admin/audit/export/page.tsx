import { PageHeader } from "@/components/composites/page-header";
import { AuditExportForm } from "@/components/enterprise/enterprise";
import { EnterpriseTabs } from "@/components/enterprise/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { previewExport } from "@/lib/enterprise/audit-export";
import { PlanNotice } from "@/components/billing/plan-notice";
import { tenantPlan } from "@/lib/plan-gate";

export const metadata = { title: "Audit export" };
export const dynamic = "force-dynamic";

const FIELDS = ["id", "timestamp", "tenant_id", "actor_type", "actor_id", "actor_name", "action", "entity_type", "entity_id", "mandate_id", "ip", "user_agent", "request_id", "model", "input_tokens", "output_tokens", "cost_usd", "duration_ms", "detail", "before", "after"];

export default async function AuditExportPage() {
  const user = await requireRole(["tenant_admin"]);
  const plan = await tenantPlan(user.tenantId);
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  const { entityTypes } = await previewExport(await getDb(), user.tenantId, { from, to });
  return (
    <PageContainer>
      <PageHeader eyebrow="Enterprise" title="Audit export" subtitle="Every action by a person, an AI agent or the system, with before and after values, for review, regulators or the firm's SIEM." />
      <EnterpriseTabs active="/admin/audit/export" />
      <PlanNotice plan={plan} module="audit_export" />
      <Section title="Export">
        <AuditExportForm entityTypes={entityTypes} defaults={{ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }} />
      </Section>
      <Section title="Format" description="JSON Lines puts one event per line, ready for Splunk, Datadog, Elastic or Microsoft Sentinel. CSV opens in a spreadsheet; nested values are JSON within the cell.">
        <div className="rounded-md border border-hairline bg-surface p-5">
          <div className="flex flex-wrap gap-2">
            {FIELDS.map((f) => (
              <code key={f} className="num rounded-full border border-hairline px-2 text-[12px] text-ink-700">
                {f}
              </code>
            ))}
          </div>
          <p className="mt-4 max-w-[70ch] text-small text-ink-700">
            Each download returns the file&rsquo;s SHA-256 digest and an HMAC-SHA256 signature over the digest and the export parameters. Recompute the digest at any time; Nakhla support can confirm the signature, showing that the file is the one exported. Audit records are kept for seven years and cannot be edited or deleted through the application.
          </p>
        </div>
      </Section>
    </PageContainer>
  );
}
