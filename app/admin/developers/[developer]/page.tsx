import Link from "next/link";
import { notFound } from "next/navigation";
import { ConnectDeveloper, SyncNow } from "@/components/developers/sync";
import { PageHeader } from "@/components/composites/page-header";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { developerByKey } from "@/lib/developers/catalogue";
import { inventoryView, matchingLeads } from "@/lib/developers/sync";
import { formatLocal } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Developer" };
export const dynamic = "force-dynamic";

const TONE = { available: "complete", reserved: "progress", sold: "neutral", withdrawn: "error" } as const;

export default async function DeveloperPage({ params, searchParams }: { params: Promise<{ developer: string }>; searchParams: Promise<{ status?: string; project?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { developer } = await params;
  const dev = developerByKey(developer);
  if (!dev) notFound();
  const sp = await searchParams;
  const db = await getDb();
  const status = sp.status ?? "available";
  const v = await inventoryView(db, user.tenantId, dev.key, { status, project: sp.project ?? null });
  const c = v.connection;
  const top = v.units.filter((u) => u.status === "available").slice(0, 3);
  const matches = await Promise.all(top.map((u) => matchingLeads(db, user.tenantId, u, dev.market)));
  const q = (p: Record<string, string | undefined>) => `?${new URLSearchParams(Object.entries({ status, project: sp.project, ...p }).filter(([, x]) => x) as [string, string][]).toString()}`;
  return (
    <PageContainer>
      <PageHeader eyebrow={<Link href="/admin/developers">Developer inventory</Link>} title={dev.name} subtitle={dev.note} meta={c ? <><StatusPill tone={c.status === "connected" ? "complete" : "error"}>{c.status}</StatusPill><span className="num">{c.units} units</span>{c.lastSyncAt && <span>synced <RelativeTime iso={c.lastSyncAt.toISOString()} /></span>}</> : undefined} actions={c ? <SyncNow connectionId={c.id} upload={c.mode === "upload"} /> : undefined} />
      {c?.lastError && <p className="mt-6 rounded-md border border-hairline bg-surface p-4 text-ui text-danger">{c.lastError}</p>}
      <Section title={c ? "Connection" : "Connect"} description="Ask the developer's broker or channel team for the inventory feed address, or for the latest price list to upload. The sandbox generates realistic inventory that changes daily, for rehearsal.">
        <div className="rounded-md border border-hairline bg-surface p-5">
          <ConnectDeveloper developerKey={dev.key} current={c ? { mode: c.mode, url: c.url, format: c.format } : null} />
        </div>
      </Section>
      {c && (
        <>
          <Section title="Projects">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {v.projects.map((p) => (
                <li key={p.project}>
                  <Link href={q({ project: sp.project === p.project ? undefined : p.project })} className={cn("block rounded-md border bg-surface p-4", sp.project === p.project ? "border-gold-500" : "border-hairline")}>
                    <div className="text-ui text-ink-900">{p.project}</div>
                    <div className="num mt-1 text-[12px] text-ink-500">
                      {p.available} of {p.n} available{p.minPrice ? ` · from ${formatLocal(p.minPrice, dev.market === "IN" ? "INR" : "AED")}` : ""}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
          {top.length > 0 && (
            <Section title="Buyers to call" description="Open buyer leads whose budget reaches these available units.">
              <ul className="grid gap-3 lg:grid-cols-3">
                {top.map((u, i) => (
                  <li key={u.id} className="rounded-md border border-hairline bg-surface p-4">
                    <div className="text-ui text-ink-900">
                      {u.project} <span className="num">{u.unitRef}</span>
                    </div>
                    <div className="num text-[12px] text-ink-500">{u.price ? formatLocal(u.price, u.currency, { compact: false }) : "Price on request"}</div>
                    <ul className="mt-2 space-y-1 text-[13px]">
                      {matches[i]!.map((l) => (
                        <li key={l.id}>
                          <Link href={`/analyst/leads/${l.id}`} className="text-ink-900 underline-offset-4 hover:underline">
                            {l.name}
                          </Link>
                          <span className="num ms-2 text-ink-500">{l.score}</span>
                        </li>
                      ))}
                      {!matches[i]!.length && <li className="text-ink-500">No matching buyers.</li>}
                    </ul>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section
            title="Units"
            actions={
              <div className="flex gap-3 text-ui">
                {["available", "reserved", "sold", "withdrawn", "all"].map((st) => (
                  <Link key={st} href={q({ status: st })} className={status === st ? "text-ink-900 underline underline-offset-4" : "text-ink-500 hover:text-ink-900"}>
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </Link>
                ))}
              </div>
            }
          >
            <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
              <table className="w-full min-w-[860px] text-ui">
                <thead>
                  <tr className="border-b border-hairline label-caps">
                    <th className="px-4 py-3 text-start font-medium">Unit</th>
                    <th className="px-3 py-3 text-start font-medium">Project</th>
                    <th className="px-3 py-3 text-start font-medium">Type</th>
                    <th className="px-3 py-3 text-end font-medium">Area, sq ft</th>
                    <th className="px-3 py-3 text-end font-medium">Price</th>
                    <th className="px-3 py-3 text-start font-medium">Handover</th>
                    <th className="px-4 py-3 text-start font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline-row">
                  {v.units.map((u) => (
                    <tr key={u.id}>
                      <td className="num px-4 py-2.5 text-ink-900">{u.unitRef}</td>
                      <td className="px-3 py-2.5 text-ink-700">
                        {u.project}
                        {u.building ? `, ${u.building}` : ""}
                      </td>
                      <td className="px-3 py-2.5 text-ink-700">{u.unitType ?? (u.bedrooms === null ? "" : u.bedrooms === 0 ? "Studio" : `${u.bedrooms} bed`)}</td>
                      <td className="num px-3 py-2.5 text-end text-ink-700">{u.areaSqft ? Math.round(u.areaSqft).toLocaleString("en-US") : ""}</td>
                      <td className="num px-3 py-2.5 text-end text-ink-900">
                        {u.price ? formatLocal(u.price, u.currency, { compact: false }) : ""}
                        {u.previousPrice && u.price && <div className={cn("text-[11px]", u.price < u.previousPrice ? "text-success" : "text-warning")}>was {formatLocal(u.previousPrice, u.currency, { compact: false })}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-ink-700">{u.handover}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill tone={TONE[u.status]}>{u.status}</StatusPill>
                      </td>
                    </tr>
                  ))}
                  {!v.units.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-ink-500">
                        No {status === "all" ? "" : status} units.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="Changes in the last fourteen days">
            <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface text-ui">
              {v.changes.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-ink-900">
                    {u.project} <span className="num">{u.unitRef}</span>
                  </span>
                  <span className="text-[13px] text-ink-700">
                    {u.priceChangedAt && u.previousPrice && u.price ? `Price ${formatLocal(u.previousPrice, u.currency)} to ${formatLocal(u.price, u.currency)}` : ""}
                    {u.priceChangedAt && u.statusChangedAt ? " · " : ""}
                    {u.statusChangedAt ? `Now ${u.status}` : ""}
                  </span>
                </li>
              ))}
              {!v.changes.length && <li className="px-4 py-3 text-ink-500">No changes.</li>}
            </ul>
          </Section>
        </>
      )}
    </PageContainer>
  );
}
