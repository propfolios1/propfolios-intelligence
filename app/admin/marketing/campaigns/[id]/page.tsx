import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/composites/page-header";
import { CampaignControls } from "@/components/marketing/automation";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { campaignStats } from "@/lib/marketing/service";

export const metadata = { title: "Campaign" };
export const dynamic = "force-dynamic";

const fmtDelay = (h: number) => (h === 0 ? "immediately" : h % 24 === 0 ? `${h / 24} ${h === 24 ? "day" : "days"}` : `${h} hours`);

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const st = await campaignStats(await getDb(), user.tenantId, id).catch(() => null);
  if (!st) notFound();
  const c = st.campaign;
  const trigger = c.trigger?.event === "lead_created" ? "Each new matching lead enters as it arrives." : c.kind === "auto_promote" ? "Every new listing, and every price cut of 2% or more, is promoted to matching leads." : "Sent to the audience when activated.";
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Link href="/admin/marketing">Marketing</Link>}
        title={c.name}
        subtitle={trigger}
        meta={
          <>
            <StatusPill tone={c.active ? "progress" : c.status === "completed" ? "complete" : "neutral"}>{c.status}</StatusPill>
            <span className="num">{st.enrolled} enrolled</span>
            <span className="num">{st.won} won since enrolment</span>
          </>
        }
        actions={<CampaignControls id={c.id} status={c.status} active={c.active} />}
      />
      <Section title="Steps">
        <ol className="grid gap-3">
          {st.steps.map((step) => (
            <li key={step.id} className="grid gap-3 rounded-md border border-hairline bg-surface p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="min-w-0">
                <div className="label-caps">
                  Step {step.position} · {step.channel === "email" ? "Email" : "WhatsApp template"} · {step.position === 1 ? "after enrolment" : "after the previous step"}, {fmtDelay(step.delayHours)}
                </div>
                {step.subject && <div className="mt-2 text-ui font-medium text-ink-900">{step.subject}</div>}
                <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-[13px] text-ink-700">{step.body}</p>
              </div>
              <dl className="num grid grid-cols-4 gap-2 text-center text-[12px]">
                {(["scheduled", "sent", "skipped", "failed"] as const).map((k) => (
                  <div key={k} className="rounded-sm border border-hairline p-2">
                    <dd className="text-[18px] text-ink-900">{step.counts[k] ?? 0}</dd>
                    <dt className="font-sans text-ink-500">{k}</dt>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      </Section>
      {st.reasons.length > 0 && (
        <Section title="Why messages were not sent">
          <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface text-ui">
            {st.reasons.map((r) => (
              <li key={r.reason ?? "none"} className="flex justify-between px-4 py-2.5">
                <span className="text-ink-700">{r.reason ?? "Not recorded"}</span>
                <span className="num text-ink-900">{r.n}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {st.posts.length > 0 && (
        <Section title="Social posts">
          <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface text-ui">
            {st.posts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <span className="min-w-0 truncate text-ink-900">{p.caption}</span>
                <span className="flex items-center gap-2 text-[12px] text-ink-500">
                  {p.networks.join(", ")} · <RelativeTime iso={p.scheduledAt.toISOString()} /> <StatusPill tone={p.status === "published" ? "complete" : p.status === "failed" ? "error" : "progress"}>{p.status}</StatusPill>
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </PageContainer>
  );
}
