import { QuickLog } from "@/components/mobile/runtime";
import { MCard, MTitle, Pill } from "@/components/mobile/ui";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { whatsappLink } from "@/lib/brokerage/leads";
import { SOURCE_NAME } from "@/lib/markets";
import { agentSnapshot } from "@/lib/pwa/snapshot";

export default async function MobileLeads() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { leads } = await agentSnapshot(await getDb(), user);
  const open = leads.filter((l) => !["won", "lost"].includes(l.stage)).sort((a, b) => b.score - a.score);
  return (
    <>
      <MTitle note={`${open.length} open, highest score first. Available offline.`}>Leads</MTitle>
      <ul className="space-y-2">
        {open.map((l) => (
          <li key={l.id}>
            <MCard>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[15px] text-ink-900">{l.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Pill>{l.stage}</Pill>
                    <Pill>{SOURCE_NAME[l.source] ?? l.source}</Pill>
                  </div>
                </div>
                <span className="num text-[18px] text-navy-900">{l.score}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {l.phone && (
                  <a href={`tel:${l.phone}`} className="h-8 rounded-sm bg-navy-900 px-3 text-[12px] leading-8 text-surface">
                    Call
                  </a>
                )}
                {l.phone && (
                  <a href={whatsappLink(l.phone, `Hello ${l.name.split(" ")[0]}, following up on your enquiry.`)} className="h-8 rounded-sm border border-hairline px-3 text-[12px] leading-8 text-ink-700">
                    WhatsApp
                  </a>
                )}
                <QuickLog leadId={l.id} name={l.name} />
              </div>
            </MCard>
          </li>
        ))}
      </ul>
    </>
  );
}
