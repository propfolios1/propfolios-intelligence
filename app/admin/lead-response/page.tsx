import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { headers } from "next/headers";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { HandoffButtons, LeadResponseSettings, PreviewConsole } from "@/components/lead-response/lead-response";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { CopyButton } from "@/components/ui/copy-button";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { feedToken } from "@/lib/brokerage/feed-token";
import { FIELD_LABEL, questionOrder } from "@/lib/lead-response/policy";
import { HANDOFF_LABEL, lrConfig, lrMetrics } from "@/lib/lead-response/service";
import { scope } from "@/lib/tenant-db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Lead response" };
export const dynamic = "force-dynamic";

const secs = (ms: number | null) => (ms === null ? "No replies yet" : ms < 10_000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms / 1000)}s`);
const pct = (x: number | null) => (x === null ? "No data" : `${Math.round(x * 100)}%`);

export default async function LeadResponsePage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [cfg, m, handoffs, listings] = await Promise.all([
    lrConfig(db, user.tenantId),
    lrMetrics(db, user.tenantId),
    db
      .select({ h: s.leadHandoffs, lead: s.leads.name, ref: s.leads.reference, agent: s.users.name })
      .from(s.leadHandoffs)
      .innerJoin(s.leads, eq(s.leads.id, s.leadHandoffs.leadId))
      .leftJoin(s.users, eq(s.users.id, s.leadHandoffs.toUserId))
      .where(scope(s.leadHandoffs, user.tenantId, inArray(s.leadHandoffs.status, ["open", "accepted"])))
      .orderBy(s.leadHandoffs.slaDueAt)
      .limit(25),
    db.select({ id: s.listings.id, title: s.listings.title, purpose: s.listings.purpose }).from(s.listings).where(scope(s.listings, user.tenantId, and(eq(s.listings.status, "active")))).orderBy(desc(s.listings.createdAt)).limit(40),
  ]);
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const mailToken = feedToken(user.tenantId, "email-inbound");
  const calToken = feedToken(user.id, "calendar");
  const order = questionOrder(cfg.learning, "buy");
  const now = Date.now();
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Lead response" subtitle="Every new enquiry on WhatsApp, email, the website and the portals is answered within seconds. The assistant qualifies budget, timeline, area, motivation and financing in the lead's own words, books viewings against the agent's calendar, and hands over to an agent with a deadline." />
      <section className="my-8 stat-row">
        <StatCard label="Median first reply" value={secs(m.medianFirstMs)} note={`${m.conversations} conversations in 30 days`} />
        <StatCard label="Replies under 10 seconds" value={pct(m.underTenSeconds)} note={`p95 ${secs(m.p95ReplyMs)} across ${m.replies} replies`} />
        <StatCard label="Qualified" value={pct(m.qualifiedShare)} note="Three of five answers or more" />
        <StatCard label="Viewings booked" value={String(m.bookings)} note={`${m.openHandoffs} hand-offs open${m.breached ? `, ${m.breached} past SLA` : ""}`} />
      </section>

      <Section title="Hand-offs" description="Conversations the assistant has passed to an agent, oldest deadline first. Accepting assigns the lead to you.">
        {handoffs.length ? (
          <div className="overflow-x-auto rounded-md border border-hairline bg-surface">
            <table className="w-full min-w-[720px] text-ui">
              <thead>
                <tr className="border-b border-hairline text-start label-caps">
                  <th className="px-4 py-3 text-start font-medium">Lead</th>
                  <th className="px-3 py-3 text-start font-medium">Reason</th>
                  <th className="px-3 py-3 text-start font-medium">Agent</th>
                  <th className="px-3 py-3 text-start font-medium">Due</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline-row">
                {handoffs.map(({ h: x, lead, ref, agent }) => (
                  <tr key={x.id}>
                    <td className="px-4 py-3">
                      <Link href={`/analyst/leads/${x.leadId}/conversation`} className="text-ink-900 underline-offset-4 hover:underline">
                        {lead}
                      </Link>
                      <span className="num ms-2 text-[12px] text-ink-500">{ref}</span>
                      <div className="mt-0.5 max-w-[48ch] truncate text-[12px] text-ink-500">{x.detail}</div>
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill tone={x.reason === "complaint" ? "error" : x.reason === "viewing_booked" || x.reason === "qualified" ? "complete" : "progress"}>{HANDOFF_LABEL[x.reason]}</StatusPill>
                    </td>
                    <td className="px-3 py-3 text-ink-700">{agent ?? "Unassigned"}</td>
                    <td className={cn("px-3 py-3", x.status === "open" && x.slaDueAt.getTime() < now ? "text-danger" : "text-ink-700")}>
                      {x.status === "accepted" ? "Accepted" : <RelativeTime iso={x.slaDueAt.toISOString()} />}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <HandoffButtons id={x.id} status={x.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ui text-ink-500">No open hand-offs. The assistant is handling every active conversation.</p>
        )}
      </Section>

      <Section title="What the assistant has learned" description="The order of questions follows how readily this firm's leads answer each one. Agents' own replies set the register the model writes in.">
        <div className="grid gap-6 lg:grid-cols-2">
          <ol className="rounded-md border border-hairline bg-surface">
            {order.map((f, i) => {
              const a = cfg.learning.answers[f];
              const rate = a && a.asked ? a.answered / a.asked : null;
              return (
                <li key={f} className="grid grid-cols-[28px_minmax(0,1fr)_120px] items-center gap-3 border-b border-hairline-row px-4 py-3 last:border-b-0">
                  <span className="num text-ink-500">{i + 1}</span>
                  <span className="text-ui text-ink-900">
                    {FIELD_LABEL[f]}
                    <span className="block text-[12px] text-ink-500">{a?.asked ? `Answered ${a.answered} of ${a.asked} times asked` : "Not asked yet"}</span>
                  </span>
                  <span className="h-1.5 rounded-full bg-ink-100" aria-label={rate === null ? "No data" : `${Math.round(rate * 100)}% answered`}>
                    <span className="block h-1.5 rounded-full bg-navy-700" style={{ width: `${Math.round((rate ?? 0) * 100)}%` }} />
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="rounded-md border border-hairline bg-surface p-5 text-ui">
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="label-caps">Conversations</dt>
                <dd className="num mt-1 text-[24px] text-ink-900">{cfg.learning.conversions.total}</dd>
              </div>
              <div>
                <dt className="label-caps">Booked by the assistant</dt>
                <dd className="num mt-1 text-[24px] text-ink-900">{cfg.learning.conversions.booked}</dd>
              </div>
              <div>
                <dt className="label-caps">Fully qualified</dt>
                <dd className="num mt-1 text-[24px] text-ink-900">{cfg.learning.conversions.qualified}</dd>
              </div>
              <div>
                <dt className="label-caps">Agent replies learned from</dt>
                <dd className="num mt-1 text-[24px] text-ink-900">{cfg.learning.examples.length}</dd>
              </div>
            </dl>
            <p className="mt-4 text-[13px] text-ink-500">Agents&apos; WhatsApp and email replies are read as examples of the firm&apos;s voice. Nothing leaves this workspace.</p>
          </div>
        </div>
      </Section>

      <Section title="Preview" description="Test the assistant on any enquiry before it meets a real lead.">
        <PreviewConsole listings={listings} />
      </Section>

      <Section title="Settings">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-md border border-hairline bg-surface p-6">
            <LeadResponseSettings settings={cfg.settings} />
          </div>
          <div className="grid content-start gap-4">
            <div className="rounded-md border border-hairline bg-surface p-5">
              <div className="label-caps">Inbound email</div>
              <p className="mt-2 text-[13px] text-ink-700">Point the reply-to address&apos;s inbound route (Resend, Postmark or SendGrid Inbound Parse) at this URL so leads&apos; email replies reach the assistant.</p>
              {mailToken ? (
                <div className="mt-3 flex items-center gap-2">
                  <code className="num min-w-0 flex-1 truncate rounded-sm bg-ink-100 px-2 py-1.5 text-[12px]">{`${origin}/api/webhooks/email/${user.tenantId}?token=${mailToken}`}</code>
                  <CopyButton value={`${origin}/api/webhooks/email/${user.tenantId}?token=${mailToken}`} label="Copy" />
                </div>
              ) : (
                <p className="mt-3 text-[13px] text-warning">Set FEED_SECRET in the environment to issue the inbound URL.</p>
              )}
            </div>
            <div className="rounded-md border border-hairline bg-surface p-5">
              <div className="label-caps">Your viewing calendar</div>
              <p className="mt-2 text-[13px] text-ink-700">Subscribe from Google Calendar, Outlook or Apple Calendar. Viewings the assistant books appear within fifteen minutes.</p>
              {calToken && (
                <div className="mt-3 flex items-center gap-2">
                  <code className="num min-w-0 flex-1 truncate rounded-sm bg-ink-100 px-2 py-1.5 text-[12px]">{`${origin}/api/calendar/${user.id}.ics?token=${calToken}`}</code>
                  <CopyButton value={`${origin}/api/calendar/${user.id}.ics?token=${calToken}`} label="Copy" />
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>
    </PageContainer>
  );
}
