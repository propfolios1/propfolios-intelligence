import Link from "next/link";
import { notFound } from "next/navigation";
import { LineSeries } from "@/components/charts/series";
import { PageHeader } from "@/components/composites/page-header";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { CoachingNote, PeriodPicker } from "@/components/team/team";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatLocal } from "@/lib/format";
import { marketOf } from "@/lib/markets";
import { METRICS } from "@/lib/team/coaching";
import { agentView, ensureHistory, periodOf, previousPeriods } from "@/lib/team/metrics";
import { cn } from "@/lib/utils";

export const metadata = { title: "Agent performance" };
export const dynamic = "force-dynamic";

export default async function AgentPage({ params, searchParams }: { params: Promise<{ user_id: string }>; searchParams: Promise<{ period?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { user_id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(user_id)) notFound();
  const db = await getDb();
  await ensureHistory(db, user.tenantId, 6);
  const periods = previousPeriods(periodOf(), 6);
  const sp = (await searchParams).period;
  const period = sp && periods.includes(sp) ? sp : periods[0]!;
  const v = await agentView(db, user.tenantId, user_id, period).catch(() => null);
  if (!v) notFound();
  const cur = marketOf(null).currency;
  const m = v.current?.metrics;
  const med = v.snap?.medians ?? {};
  const fmt = (format: string, x: number | null | undefined) => (x === null || x === undefined ? "No data" : format === "money" ? formatLocal(x, cur) : format === "pct" ? `${x}%` : format === "hours" ? `${x} h` : format === "days" ? `${Math.round(x)} days` : String(x));
  return (
    <PageContainer>
      <PageHeader eyebrow={<Link href={`/admin/team?period=${period}`}>Team · Performance</Link>} title={v.user.name} subtitle={`${v.user.email ?? ""}. Each figure is compared with the team median for the same month.`} actions={<PeriodPicker periods={periods} value={period} base={`/admin/team/${user_id}`} />} />
      {m ? (
        <>
          <section className="mt-8 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.filter((k) => k.key !== "dealValue").map((k) => {
              const val = m[k.key] as number | null;
              const b = med[k.key] ?? null;
              const better = val !== null && b !== null && (k.better === "higher" ? val > b : val < b);
              const worse = val !== null && b !== null && (k.better === "higher" ? val < b : val > b);
              return (
                <div key={k.key} className="bg-surface p-4">
                  <div className="label-caps">{k.label}</div>
                  <div className="num mt-1 text-[22px] text-ink-900">{fmt(k.format, val)}</div>
                  <div className={cn("num mt-1 text-[12px]", better ? "text-success" : worse ? "text-warning" : "text-ink-500")}>Team median {fmt(k.format, b)}</div>
                </div>
              );
            })}
          </section>
          <Section title="Coaching">
            <div className="grid gap-6 lg:grid-cols-2">
              <ul className="grid content-start gap-3">
                {v.current!.flags.map((f) => (
                  <li key={f.key} className="rounded-md border border-hairline bg-surface p-4">
                    <div className="flex flex-wrap items-center gap-2 text-ui text-ink-900">
                      {f.title} <StatusPill tone={f.kind === "recognition" ? "complete" : f.severity === "high" ? "error" : "progress"}>{f.kind === "recognition" ? "Recognition" : f.severity}</StatusPill>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-700">{f.detail}</p>
                    <p className="mt-2 text-[13px] text-ink-900">{f.action}</p>
                  </li>
                ))}
                {!v.current!.flags.length && <li className="text-ui text-ink-500">Nothing to raise this month.</li>}
              </ul>
              <div className="grid content-start gap-4">
                <CoachingNote userId={user_id} period={period} flags={v.current!.flags.map((f) => ({ key: f.key, title: f.title }))} />
                <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
                  {[...v.current!.notes].reverse().map((n, i) => (
                    <li key={i} className="px-4 py-3 text-ui">
                      <p className="text-ink-900">{n.text}</p>
                      <p className="mt-1 text-[12px] text-ink-500">
                        {n.by} · <RelativeTime iso={n.at} />
                        {n.flag ? ` · ${v.current!.flags.find((f) => f.key === n.flag)?.title ?? n.flag}` : ""}
                      </p>
                    </li>
                  ))}
                  {!v.current!.notes.length && <li className="px-4 py-3 text-ui text-ink-500">No notes for this month.</li>}
                </ul>
              </div>
            </div>
          </Section>
          {v.history.length > 1 && (
            <Section title="Six months">
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-md border border-hairline bg-surface p-4">
                  <div className="label-caps mb-3">Commission</div>
                  <LineSeries data={v.history.map((h) => ({ month: h.period, gci: Math.round(h.metrics.gci) }))} x="month" series={[{ key: "gci", label: "Commission" }]} height={200} />
                </div>
                <div className="rounded-md border border-hairline bg-surface p-4">
                  <div className="label-caps mb-3">Leads and activity</div>
                  <LineSeries data={v.history.map((h) => ({ month: h.period, leads: h.metrics.leadsAssigned, activity: h.metrics.activities }))} x="month" series={[{ key: "leads", label: "Leads" }, { key: "activity", label: "Activity" }]} height={200} format="number" />
                </div>
              </div>
            </Section>
          )}
          <Section title="Overdue follow-ups">
            <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
              {v.overdueLeads.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-ui">
                  <Link href={`/analyst/leads/${l.id}`} className="text-ink-900 underline-offset-4 hover:underline">
                    {l.name} <span className="num text-[12px] text-ink-500">{l.reference}</span>
                  </Link>
                  <span className="text-[12px] text-danger">
                    {l.nextAction ?? "Next action"} · <RelativeTime iso={l.nextActionAt!.toISOString()} />
                  </span>
                </li>
              ))}
              {!v.overdueLeads.length && <li className="px-4 py-3 text-ui text-ink-500">None overdue.</li>}
            </ul>
          </Section>
        </>
      ) : (
        <p className="mt-8 text-ui text-ink-500">No metrics recorded for this month yet.</p>
      )}
    </PageContainer>
  );
}
