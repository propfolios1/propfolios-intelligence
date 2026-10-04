import { MCard, MStat, MTitle, Pill } from "@/components/mobile/ui";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatLocal } from "@/lib/format";
import { agentSnapshot } from "@/lib/pwa/snapshot";

export default async function MobileCommissions() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { commissions } = await agentSnapshot(await getDb(), user);
  const cur = commissions[0]?.currency ?? "AED";
  const sum = (st: string[]) => commissions.filter((c) => st.includes(c.status)).reduce((a, c) => a + c.amount, 0);
  return (
    <>
      <MTitle note="Commission credited to you, from closed deals.">Commissions</MTitle>
      <div className="grid grid-cols-2 gap-3">
        <MStat label="Expected" value={formatLocal(sum(["expected", "invoiced"]), cur)} />
        <MStat label="Received" value={formatLocal(sum(["received", "paid_out"]), cur)} />
      </div>
      <ul className="mt-6 space-y-2">
        {commissions.map((c) => (
          <li key={c.id}>
            <MCard className="flex items-center justify-between">
              <div>
                <div className="num text-[17px] text-navy-900">{formatLocal(c.amount, c.currency)}</div>
                <div className="text-[12px] text-ink-500">{c.expectedDate ? `Expected ${c.expectedDate}` : ""}</div>
              </div>
              <Pill>{c.status.replace(/_/g, " ")}</Pill>
            </MCard>
          </li>
        ))}
        {!commissions.length && <p className="text-[14px] text-ink-500">No commission records yet.</p>}
      </ul>
    </>
  );
}
