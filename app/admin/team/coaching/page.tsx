import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { PeriodPicker } from "@/components/team/team";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { ensureHistory, periodOf, previousPeriods, teamView } from "@/lib/team/metrics";

export const metadata = { title: "Coaching" };
export const dynamic = "force-dynamic";

const SEV = { high: 0, medium: 1, low: 2 } as const;

export default async function Coaching({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  await ensureHistory(db, user.tenantId, 6);
  const periods = previousPeriods(periodOf(), 6);
  const sp = (await searchParams).period;
  const period = sp && periods.includes(sp) ? sp : periods[0]!;
  const { rows } = await teamView(db, user.tenantId, period);
  const concerns = rows.flatMap((r) => r.a.flags.filter((f) => f.kind === "concern").map((f) => ({ ...f, userId: r.a.userId, name: r.name, noted: r.a.notes.some((n) => n.flag === f.key) }))).sort((a, b) => SEV[a.severity] - SEV[b.severity] || Number(a.noted) - Number(b.noted));
  const recognitions = rows.flatMap((r) => r.a.flags.filter((f) => f.kind === "recognition").map((f) => ({ ...f, userId: r.a.userId, name: r.name })));
  return (
    <PageContainer>
      <PageHeader eyebrow={<Link href={`/admin/team?period=${period}`}>Team · Performance</Link>} title="Coaching" subtitle="What to raise with each agent this month, most serious first, and what to recognise. Each item says why it was raised and what to do; record the conversation on the agent's page." actions={<PeriodPicker periods={periods} value={period} base="/admin/team/coaching" />} />
      <Section title={`To discuss, ${concerns.length}`}>
        <ul className="grid gap-3 lg:grid-cols-2">
          {concerns.map((f) => (
            <li key={`${f.userId}:${f.key}`} className="rounded-md border border-hairline bg-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/admin/team/${f.userId}?period=${period}`} className="text-ui text-ink-900 underline-offset-4 hover:underline">
                  {f.name}
                </Link>
                <span className="flex gap-2">
                  {f.noted && <StatusPill tone="complete">Discussed</StatusPill>}
                  <StatusPill tone={f.severity === "high" ? "error" : "progress"}>{f.severity}</StatusPill>
                </span>
              </div>
              <div className="mt-2 text-ui font-medium text-ink-900">{f.title}</div>
              <p className="mt-1 text-[13px] text-ink-700">{f.detail}</p>
              <p className="mt-2 text-[13px] text-ink-900">{f.action}</p>
            </li>
          ))}
          {!concerns.length && <li className="text-ui text-ink-500">Nothing to raise this month.</li>}
        </ul>
      </Section>
      <Section title={`To recognise, ${recognitions.length}`}>
        <ul className="grid gap-3 lg:grid-cols-3">
          {recognitions.map((f) => (
            <li key={`${f.userId}:${f.key}`} className="rounded-md border border-hairline bg-surface p-4">
              <Link href={`/admin/team/${f.userId}?period=${period}`} className="text-ui text-ink-900 underline-offset-4 hover:underline">
                {f.name}
              </Link>
              <div className="mt-1 text-ui font-medium text-ink-900">{f.title}</div>
              <p className="mt-1 text-[13px] text-ink-700">{f.detail}</p>
            </li>
          ))}
          {!recognitions.length && <li className="text-ui text-ink-500">No recognitions this month.</li>}
        </ul>
      </Section>
    </PageContainer>
  );
}
