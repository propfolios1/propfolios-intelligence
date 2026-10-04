import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/composites/page-header";
import { EmailReply, HandoffButtons, ResumeAssistant } from "@/components/lead-response/lead-response";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { formatLocal } from "@/lib/format";
import { slotLabel } from "@/lib/lead-response/calendar";
import { HANDOFF_LABEL, lrConfig } from "@/lib/lead-response/service";
import { scope } from "@/lib/tenant-db";
import { cn } from "@/lib/utils";

export const metadata = { title: "Lead conversation" };
export const dynamic = "force-dynamic";

const CHANNEL: Record<string, string> = { whatsapp: "WhatsApp", email: "Email", website: "Website enquiry, by email", portal: "Portal enquiry, by email" };
const STATUS: Record<string, [string, "progress" | "complete" | "neutral" | "error"]> = { active: ["Assistant replying", "progress"], handed_off: ["With an agent", "neutral"], booked: ["Viewing booked", "complete"], closed: ["Closed", "neutral"] };
const TIMELINE: Record<string, string> = { immediate: "Immediate", "3_months": "Within 3 months", "6_months": "Within 6 months", "12_months": "Within 12 months", exploring: "Exploring" };
const MOTIVATION: Record<string, string> = { end_use: "Own use", investment: "Investment", relocation: "Relocation", upsizing: "Moving up or down", residency_visa: "Residency", other: "Other" };
const FINANCING: Record<string, string> = { cash: "Cash", mortgage_approved: "Mortgage approved in principle", mortgage_needed: "Mortgage to arrange", undecided: "Undecided" };

export default async function LeadConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [lead] = await db.select().from(s.leads).where(scope(s.leads, user.tenantId, eq(s.leads.id, id)));
  if (!lead) notFound();
  const [cfg, convs, [q], handoffs, bookings] = await Promise.all([
    lrConfig(db, user.tenantId),
    db.select().from(s.leadConversations).where(scope(s.leadConversations, user.tenantId, eq(s.leadConversations.leadId, id))).orderBy(desc(s.leadConversations.updatedAt)),
    db.select().from(s.leadQualifications).where(scope(s.leadQualifications, user.tenantId, eq(s.leadQualifications.leadId, id))),
    db.select({ h: s.leadHandoffs, agent: s.users.name }).from(s.leadHandoffs).leftJoin(s.users, eq(s.users.id, s.leadHandoffs.toUserId)).where(scope(s.leadHandoffs, user.tenantId, eq(s.leadHandoffs.leadId, id))).orderBy(desc(s.leadHandoffs.createdAt)),
    db.select({ b: s.viewingBookings, agent: s.users.name }).from(s.viewingBookings).leftJoin(s.users, eq(s.users.id, s.viewingBookings.agentUserId)).where(scope(s.viewingBookings, user.tenantId, eq(s.viewingBookings.leadId, id))).orderBy(desc(s.viewingBookings.startsAt)),
  ]);
  const tz = cfg.settings.hours.timezone;
  const currency = q?.currency ?? lead.currency;
  const budget = q?.budgetMin && q?.budgetMax ? `${formatLocal(q.budgetMin, currency, { compact: false })} to ${formatLocal(q.budgetMax, currency, { compact: false })}` : q?.budgetMax ? `Up to ${formatLocal(q.budgetMax, currency, { compact: false })}` : q?.budgetMin ? `From ${formatLocal(q.budgetMin, currency, { compact: false })}` : null;
  const rows: [string, string | null, string | undefined][] = [
    ["Budget", budget, q?.evidence.budget],
    ["Timeline", q?.timeline ? TIMELINE[q.timeline]! : null, q?.evidence.timeline],
    ["Area", q?.areas.length ? q.areas.join(", ") : null, q?.evidence.area],
    ["Bedrooms", q?.bedrooms !== null && q?.bedrooms !== undefined ? (q.bedrooms === 0 ? "Studio" : String(q.bedrooms)) : null, q?.evidence.bedrooms],
    ["Motivation", q?.motivation ? MOTIVATION[q.motivation]! : null, q?.evidence.motivation],
    ["Financing", q?.financing ? FINANCING[q.financing]! : null, q?.evidence.financing],
  ];
  return (
    <PageContainer>
      <PageHeader
        eyebrow={`Leads · ${lead.reference} · Conversation`}
        title={lead.name}
        subtitle="Everything the lead has said, what the assistant read from it and replied, and where an agent took over."
        actions={
          <Button asChild variant="secondary">
            <Link href={`/analyst/leads/${lead.id}`}>Lead record</Link>
          </Button>
        }
      />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          {convs.length === 0 && <p className="text-ui text-ink-500">The assistant has not spoken with this lead. Conversations start when the lead writes on WhatsApp or enquires through the website or a portal.</p>}
          {convs.map((c) => (
            <Section key={c.id} title={CHANNEL[c.channel] ?? c.channel} description={c.firstResponseMs !== null ? `First reply in ${(c.firstResponseMs / 1000).toFixed(1)} seconds.` : undefined}>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <StatusPill tone={STATUS[c.status]![1]}>{STATUS[c.status]![0]}</StatusPill>
                {(c.status === "handed_off" || c.status === "booked") && <ResumeAssistant conversationId={c.id} />}
                {c.channel === "whatsapp" && (
                  <Link href={`/analyst/leads/${lead.id}#whatsapp`} className="text-ui text-ink-700 underline underline-offset-4">
                    Open the WhatsApp thread
                  </Link>
                )}
              </div>
              <ol className="space-y-3 rounded-md border border-hairline bg-canvas p-4">
                {c.turns.map((t, i) => (
                  <li key={i} className={cn("flex", t.role === "lead" ? "justify-start" : "justify-end")}>
                    <div className={cn("max-w-[82%] rounded-md px-3 py-2", t.role === "lead" ? "border border-hairline bg-surface text-ink-900" : t.role === "assistant" ? "bg-navy-900 text-surface" : "bg-navy-700 text-surface")}>
                      <p className="whitespace-pre-wrap text-[14px] leading-[1.55]">{t.text}</p>
                      <p className={cn("mt-1 text-[11px]", t.role === "lead" ? "text-ink-500" : "text-navy-100")}>
                        {t.role === "lead" ? "Lead" : t.role === "assistant" ? "Assistant" : "Agent"} · {new Date(t.at).toISOString().slice(0, 16).replace("T", " ")}
                        {typeof t.latencyMs === "number" && <span className="num"> · replied in {(t.latencyMs / 1000).toFixed(1)}s</span>}
                        {t.role === "lead" && t.extracted?.length ? ` · read: ${t.extracted.join(", ")}` : ""}
                        {t.model && t.model !== "policy" ? ` · ${t.model}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {c.channel !== "whatsapp" && (c.externalRef ?? lead.email) && (
                <div className="mt-4">
                  <EmailReply conversationId={c.id} to={c.externalRef ?? lead.email!} />
                </div>
              )}
            </Section>
          ))}
        </div>
        <aside className="space-y-8 lg:pt-10">
          <section aria-label="Qualification">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="label-caps">Qualification</h2>
              <span className="num text-ui text-ink-900">{q?.completeness ?? 0}%</span>
            </div>
            <div className="mb-3 h-1.5 rounded-full bg-ink-100">
              <div className="h-1.5 rounded-full bg-navy-700" style={{ width: `${q?.completeness ?? 0}%` }} />
            </div>
            <dl className="border-t border-hairline">
              {rows.map(([k, v, ev]) => (
                <div key={k} className="border-b border-hairline-row py-2.5 text-ui">
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-500">{k}</dt>
                    <dd className={cn("text-right", v ? "text-ink-900" : "text-ink-400")}>{v ?? "Not stated"}</dd>
                  </div>
                  {ev && <p className="mt-1 text-[12px] text-ink-500">&ldquo;{ev}&rdquo;</p>}
                </div>
              ))}
            </dl>
          </section>
          <section aria-label="Hand-offs">
            <h2 className="label-caps mb-3">Hand-offs</h2>
            {handoffs.length ? (
              <ul className="border-t border-hairline">
                {handoffs.map(({ h, agent }) => (
                  <li key={h.id} className="border-b border-hairline-row py-3 text-ui">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-ink-900">{HANDOFF_LABEL[h.reason]}</span>
                      <HandoffButtons id={h.id} status={h.status} />
                    </div>
                    <p className="mt-1 text-[12px] text-ink-500">{h.detail}</p>
                    <p className="mt-1 text-[12px] text-ink-500">
                      {agent ?? "Unassigned"} · {h.status === "open" ? <>due <RelativeTime iso={h.slaDueAt.toISOString()} /></> : h.status}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ui text-ink-500">None.</p>
            )}
          </section>
          <section aria-label="Viewings">
            <h2 className="label-caps mb-3">Viewings</h2>
            {bookings.length ? (
              <ul className="border-t border-hairline">
                {bookings.map(({ b, agent }) => (
                  <li key={b.id} className="border-b border-hairline-row py-3 text-ui">
                    <div className="text-ink-900">{slotLabel(b.startsAt, tz)}</div>
                    <p className="mt-1 text-[12px] text-ink-500">
                      {[agent, b.location, `booked by ${b.bookedBy.toLowerCase() === "assistant" ? "the assistant" : b.bookedBy}`].filter(Boolean).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ui text-ink-500">None booked.</p>
            )}
          </section>
        </aside>
      </div>
    </PageContainer>
  );
}
