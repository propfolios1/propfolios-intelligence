import { MCard, MTitle, Pill } from "@/components/mobile/ui";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/deals/domain";
import { formatLocal } from "@/lib/format";
import { agentSnapshot } from "@/lib/pwa/snapshot";

export default async function MobileDeals() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { deals } = await agentSnapshot(await getDb(), user);
  const active = deals.filter((d) => d.status === "active");
  return (
    <>
      <MTitle note={`${active.length} active of ${deals.length}. Available offline.`}>Deals</MTitle>
      <ul className="space-y-2">
        {deals.map((d) => (
          <li key={d.id}>
            <MCard>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] leading-snug text-ink-900">{d.title}</div>
                  <div className="mt-1 text-[12px] text-ink-500">
                    {d.reference}
                    {d.targetCloseDate ? ` · target ${d.targetCloseDate}` : ""}
                  </div>
                </div>
                <Pill>{d.status === "active" ? STAGE_LABEL[d.stage as keyof typeof STAGE_LABEL] ?? d.stage : d.status}</Pill>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="num text-[18px] text-navy-900">{formatLocal(d.value, d.currency)}</span>
                <span className="num text-[12px] text-ink-500">{Math.round((d.probability ?? 0) * 100)}% likely</span>
              </div>
            </MCard>
          </li>
        ))}
      </ul>
    </>
  );
}
