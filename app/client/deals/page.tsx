import Link from "next/link";
import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { Flag } from "@/components/os/badges";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { DEAL_STAGES, JURISDICTION_LABEL, STAGE_LABEL } from "@/lib/deals/domain";
import { listDeals } from "@/lib/deals/service";
import { formatLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Transactions" };
export const dynamic = "force-dynamic";

export default async function ClientDeals() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const rows = user.clientId ? await listDeals(await getDb(), user.tenantId, { clientId: user.clientId }) : [];
  return (
    <PageContainer>
      <PageHeader eyebrow="Transactions" title="Your transactions" subtitle="Each purchase or sale your advisers are running for you, the stage it has reached and what comes next." />
      <div className="mt-8 space-y-4">
        {rows.length === 0 && <EmptyState glyph="mandates" headline="No transactions in progress." />}
        {rows.map((r) => {
          const idx = DEAL_STAGES.indexOf(r.deal.stage);
          return (
            <Link key={r.deal.id} href={`/client/deals/${r.deal.id}`} className="block rounded-md border border-hairline bg-surface p-5 shadow-card transition-[border-color] duration-150 hover:border-ink-400">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">
                    {r.deal.side === "buy" ? "Purchase" : "Sale"} · {JURISDICTION_LABEL[r.deal.jurisdiction]}
                  </div>
                  <div className="mt-2 font-display text-section text-navy-900">{r.property}</div>
                </div>
                <div className="text-right">
                  <div className="num text-card text-navy-900">{formatLocal(r.deal.value, r.deal.currency)}</div>
                  <Flag tone={r.deal.status === "won" ? "complete" : r.deal.status === "lost" ? "error" : "progress"}>{r.deal.status === "active" ? STAGE_LABEL[r.deal.stage] : r.deal.status === "won" ? "Completed" : r.deal.status}</Flag>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-7 gap-1">
                {DEAL_STAGES.map((st, i) => (
                  <div key={st} className={cn("h-1 rounded-full", i < idx || r.deal.status === "won" ? "bg-navy-900" : i === idx ? "bg-gold-500" : "bg-ink-200")} />
                ))}
              </div>
            </Link>
          );
        })}
      </div>
    </PageContainer>
  );
}
