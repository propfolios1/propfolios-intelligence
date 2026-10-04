import Link from "next/link";
import { SyncAll } from "@/components/developers/sync";
import { PageHeader } from "@/components/composites/page-header";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Inventory sync" };
export const dynamic = "force-dynamic";

export default async function SyncHistory() {
  const user = await requireRole(["tenant_admin"]);
  const conns = await (await getDb()).select().from(s.developerConnections).where(scope(s.developerConnections, user.tenantId));
  const runs = conns.flatMap((c) => c.history.map((h) => ({ ...h, name: c.name, key: c.developerKey }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
  return (
    <PageContainer>
      <PageHeader eyebrow={<Link href="/admin/developers">Developer inventory</Link>} title="Sync history" subtitle="Feeds, APIs and the sandbox are synced every six hours by the scheduler; uploads are synced when uploaded. Each run is recorded with what changed." actions={<SyncAll />} />
      <Section title="Runs">
        <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
          <table className="w-full min-w-[860px] text-ui">
            <thead>
              <tr className="border-b border-hairline label-caps">
                <th className="px-4 py-3 text-start font-medium">When</th>
                <th className="px-3 py-3 text-start font-medium">Developer</th>
                <th className="px-3 py-3 text-end font-medium">Units</th>
                <th className="px-3 py-3 text-end font-medium">New</th>
                <th className="px-3 py-3 text-end font-medium">Repriced</th>
                <th className="px-3 py-3 text-end font-medium">Status changes</th>
                <th className="px-3 py-3 text-end font-medium">Withdrawn</th>
                <th className="px-4 py-3 text-start font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-row">
              {runs.map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 text-ink-700">
                    <RelativeTime iso={r.at} />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/admin/developers/${r.key}`} className="text-ink-900 underline-offset-4 hover:underline">
                      {r.name}
                    </Link>
                  </td>
                  {[r.units, r.added, r.priceChanges, r.statusChanges, r.removed].map((n, k) => (
                    <td key={k} className="num px-3 py-2.5 text-end text-ink-900">
                      {r.ok ? n : ""}
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <StatusPill tone={r.ok ? "complete" : "error"}>{r.ok ? `${r.ms} ms` : "failed"}</StatusPill>
                    {r.error && <div className="mt-1 max-w-[40ch] text-[12px] text-ink-500">{r.error}</div>}
                  </td>
                </tr>
              ))}
              {!runs.length && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-ink-500">
                    No syncs yet. Connect a developer to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>
    </PageContainer>
  );
}
