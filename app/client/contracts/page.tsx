import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { clientContracts } from "@/lib/contracts/service";

export const metadata = { title: "Contracts" };
export const dynamic = "force-dynamic";

const STATUS = { draft: ["Being prepared", "neutral"], out_for_signature: ["Awaiting signatures", "progress"], signed: ["Signed", "complete"], void: ["Withdrawn", "neutral"] } as const;

export default async function ClientContracts() {
  const user = await requireRole(["client"]);
  const rows = user.clientId ? await clientContracts(await getDb(), user.tenantId, user.clientId) : [];
  const visible = rows.filter((r) => r.c.status !== "draft");
  return (
    <PageContainer>
      <PageHeader eyebrow="Account" title="Contracts" subtitle="Agreements for your transactions. When one is ready for your signature you receive a link by email; signed contracts can be downloaded here at any time." />
      <ul className="mt-8 divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
        {visible.map(({ c, deal, ref }) => (
          <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
            <div>
              <div className="text-ui text-ink-900">{c.title}</div>
              <div className="text-[12px] text-ink-500">
                <span className="num">{ref}</span> · {deal} · version {c.version} · <RelativeTime iso={(c.signedAt ?? c.createdAt).toISOString()} />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <StatusPill tone={STATUS[c.status][1]}>{STATUS[c.status][0]}</StatusPill>
              <a href={`/api/contracts/${c.id}/pdf`} className="text-ui text-ink-900 underline underline-offset-4">
                PDF
              </a>
            </div>
          </li>
        ))}
        {!visible.length && (
          <li className="px-4 py-6 text-ui text-ink-500">
            No contracts yet. Your adviser shares them here once they are ready for signature. <Link href="/client/deals" className="underline underline-offset-4">View your transactions</Link>.
          </li>
        )}
      </ul>
    </PageContainer>
  );
}
