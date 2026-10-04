import Link from "next/link";
import { MCard, MStat, MTitle } from "@/components/mobile/ui";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatLocal } from "@/lib/format";
import { agentSnapshot } from "@/lib/pwa/snapshot";

export default async function MobileDashboard() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const snap = await agentSnapshot(await getDb(), user);
  const now = Date.now();
  const fresh = snap.leads.filter((l) => l.stage === "new");
  const due = snap.leads.filter((l) => l.nextActionAt && l.nextActionAt.getTime() < now + 86_400_000 && !["won", "lost"].includes(l.stage)).sort((a, b) => a.nextActionAt!.getTime() - b.nextActionAt!.getTime());
  const open = snap.deals.filter((d) => d.status === "active");
  const expected = snap.commissions.filter((c) => c.status === "expected" || c.status === "invoiced");
  const cur = expected[0]?.currency ?? open[0]?.currency ?? "AED";
  return (
    <>
      <MTitle note={new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}>Today</MTitle>
      <div className="grid grid-cols-2 gap-3">
        <MStat label="New leads" value={String(fresh.length)} note="Awaiting first contact" />
        <MStat label="Follow-ups due" value={String(due.length)} note="Within 24 hours" />
        <MStat label="Open deals" value={String(open.length)} note={open.length ? formatLocal(open.reduce((a, d) => a + d.value, 0), open[0]!.currency) : "None"} />
        <MStat label="Commission expected" value={formatLocal(expected.reduce((a, c) => a + c.amount, 0), cur)} note={`${expected.length} records`} />
      </div>
      <h2 className="mt-8 mb-3 label-caps">Next actions</h2>
      <ul className="space-y-2">
        {due.slice(0, 8).map((l) => (
          <li key={l.id}>
            <MCard className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[15px] text-ink-900">{l.name}</div>
                <div className="text-[12px] text-ink-500">{l.nextAction ?? "Follow up"}</div>
              </div>
              {l.phone && (
                <a href={`tel:${l.phone}`} className="h-9 shrink-0 rounded-sm bg-navy-900 px-3 text-[13px] leading-9 text-surface">
                  Call
                </a>
              )}
            </MCard>
          </li>
        ))}
        {!due.length && <p className="text-[14px] text-ink-500">Nothing due in the next 24 hours.</p>}
      </ul>
      <Link href="/m/leads" className="mt-4 block text-center text-[14px] text-navy-900">
        All leads
      </Link>
    </>
  );
}
