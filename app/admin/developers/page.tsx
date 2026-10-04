import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DEVELOPERS } from "@/lib/developers/catalogue";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Developer inventory" };
export const dynamic = "force-dynamic";

const MODE = { feed_url: "Feed", json_api: "API", upload: "Uploads", sandbox: "Sandbox" } as const;

export default async function Developers() {
  const user = await requireRole(["tenant_admin"]);
  const conns = await (await getDb()).select().from(s.developerConnections).where(scope(s.developerConnections, user.tenantId));
  const groups = [
    ["AE", "United Arab Emirates"],
    ["IN", "India"],
  ] as const;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Developer inventory"
        subtitle="Live availability and prices from the developers the firm sells for. Connect the feed or price list each developer's broker team provides; every sync records new units, price changes, sales and withdrawals, and tells the agents when a unit that matches their buyers comes back."
        actions={
          <Button asChild variant="secondary">
            <Link href="/admin/developers/sync">Sync history</Link>
          </Button>
        }
      />
      {groups.map(([m, label]) => (
        <Section key={m} title={label}>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {DEVELOPERS.filter((d) => d.market === m).map((d) => {
              const c = conns.find((x) => x.developerKey === d.key);
              return (
                <li key={d.key}>
                  <Link href={`/admin/developers/${d.key}`} className="block h-full rounded-md border border-hairline bg-surface p-4 transition-[border-color] duration-150 hover:border-ink-200">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-ui font-medium text-ink-900">{d.name}</span>
                      {c ? <StatusPill tone={c.status === "connected" ? "complete" : c.status === "error" ? "error" : "neutral"}>{MODE[c.mode]}</StatusPill> : <StatusPill tone="neutral">Not connected</StatusPill>}
                    </div>
                    <p className="mt-1 text-[12px] text-ink-500">{d.city}</p>
                    {c ? (
                      <p className="num mt-3 text-[13px] text-ink-700">
                        {c.units} units · {c.lastSyncAt ? <RelativeTime iso={c.lastSyncAt.toISOString()} /> : "never synced"}
                      </p>
                    ) : (
                      <p className="mt-3 text-[13px] text-ink-700">{d.note}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Section>
      ))}
    </PageContainer>
  );
}
