import { AuditList } from "@/components/composites/audit-list";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listAudit } from "@/lib/queries";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await requireRole(["tenant_admin"]);
  const rows = await listAudit(await getDb(), user);
  const events = rows.map(({ a, reference }) => ({
    id: a.id,
    at: a.createdAt.toISOString(),
    actor: a.actorName,
    actorType: a.actorType,
    action: a.action,
    detail: a.detail && typeof a.detail === "object" && "error" in a.detail ? String((a.detail as { error: unknown }).error) : undefined,
    mandateId: a.mandateId ?? undefined,
    reference: reference ?? undefined,
    model: a.model ?? undefined,
    costUsd: a.actorType === "agent" && a.model ? (a.costUsd ?? 0) : undefined,
    inputTokens: a.inputTokens ?? undefined,
    outputTokens: a.outputTokens ?? undefined,
    durationMs: a.durationMs ?? undefined,
  }));
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Audit log" subtitle={`${events.length} most recent events. Every agent run records its model, tokens, duration and cost; every user action records its actor.`} />
      <div className="mt-8">
        <AuditList events={events} showMandate dense />
      </div>
    </PageContainer>
  );
}
