import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { AgentOutput } from "@/components/os/agent-output";
import { StructuredDetail } from "@/components/os/structured-detail";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { portalServicing } from "@/lib/client/portal";
import { formatLocal } from "@/lib/format";

export const metadata = { title: "Private banking" };
export const dynamic = "force-dynamic";

export default async function PrivateBanking() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const p = await portalServicing(await getDb(), user);
  const eligible = (p?.client.aumAed ?? 0) >= 50_000_000;
  const plan = eligible && p ? await lastOutput<Record<string, unknown> & { headline: string; points: { label: string; detail: string }[]; confidence: number }>(user.tenantId, "private-banking-coordinator", p.client.id) : null;
  return (
    <PageContainer>
      <PageHeader eyebrow="Private office" title="Private banking" subtitle="For families with AED 50 million or more under advice: financing against your portfolio, holding structures, succession and a single point of contact across partner institutions." />
      {!eligible ? (
        <p className="mt-8 max-w-[60ch] text-body text-ink-700">This service is available to clients with declared real estate wealth of AED 50 million or more. Your relationship manager can tell you more about it.</p>
      ) : (
        <>
          <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Declared wealth" value={formatLocal(p!.client.aumAed, "AED")} />
            <StatCard label="Review cadence" value="Quarterly" note="Monthly liquidity check-in" />
            <StatCard label="Relationship" value={p!.client.type} />
          </section>
          {plan ? (
            <AgentOutput className="mt-8" agent="Your private-banking plan" output={plan.output} at={plan.at}>
              <StructuredDetail output={plan.output} />
            </AgentOutput>
          ) : (
            <p className="mt-8 text-small text-ink-500">Your plan is being prepared by your relationship manager.</p>
          )}
        </>
      )}
    </PageContainer>
  );
}
