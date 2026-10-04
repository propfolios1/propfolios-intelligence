import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadStage, LogActivity } from "@/components/brokerage/actions";
import { PageHeader } from "@/components/composites/page-header";
import { RunAgent } from "@/components/os/run-agent";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { Thread } from "@/components/whatsapp/whatsapp";
import { RelativeTime } from "@/components/ui/relative-time";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { getLead, STAGE_LABEL, whatsappLink } from "@/lib/brokerage/leads";
import { scoreBand } from "@/lib/brokerage/scoring";
import { formatLocal } from "@/lib/format";
import { marketOf, SOURCE_NAME } from "@/lib/markets";
import { scope } from "@/lib/tenant-db";
import { cn, formatDate } from "@/lib/utils";
import { convDto, tplDto } from "@/lib/whatsapp/view";

export const metadata = { title: "Lead" };
export const dynamic = "force-dynamic";

const TIMELINE: Record<string, string> = { immediate: "Immediate", "3_months": "Within 3 months", "6_months": "Within 6 months", "12_months": "Within 12 months", exploring: "Exploring" };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const d = await getLead(db, user.tenantId, id);
  if (!d) notFound();
  const [[conversation], templates] = await Promise.all([
    db.select().from(s.whatsappConversations).where(scope(s.whatsappConversations, user.tenantId, eq(s.whatsappConversations.leadId, id))).limit(1),
    db.select().from(s.whatsappTemplates).where(scope(s.whatsappTemplates, user.tenantId, eq(s.whatsappTemplates.status, "approved"))),
  ]);
  const l = d.lead;
  const m = marketOf(l.market);
  const prev = await lastOutput(user.tenantId, "lead-qualifier", id);
  const first = l.name.split(" ")[0];
  const wa = l.phone ? whatsappLink(l.phone, `Good afternoon ${first}, this is ${user.name} following up on your enquiry${d.listing ? ` about ${d.listing.title}` : ""}.`) : null;
  const facts: [string, React.ReactNode][] = [
    ["Source", SOURCE_NAME[l.source] ?? l.source],
    ["Market", `${m.name} · ${m.currency}`],
    ["Intent", l.intent.charAt(0).toUpperCase() + l.intent.slice(1)],
    ["Timeline", TIMELINE[l.timeline] ?? l.timeline],
    ["Budget", l.budgetMax ? formatLocal(l.budgetMax, l.currency, { compact: false }) : "Not stated"],
    ["Locations", l.locations.join(", ") || "Not stated"],
    ["Owner", d.owner ?? "Unassigned"],
    ["Marketing consent", l.consentMarketing ? "Given" : "Not given"],
    ["Arrived", formatDate(l.createdAt)],
  ];
  return (
    <PageContainer>
      <PageHeader
        eyebrow={`Leads · ${l.reference}`}
        title={l.name}
        subtitle={l.message ? `"${l.message}"` : undefined}
        actions={
          <>
            {wa && (
              <Button asChild variant="secondary">
                <a href={wa} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              </Button>
            )}
            {l.phone && (
              <Button asChild variant="secondary">
                <a href={`tel:${l.phone.replace(/\s/g, "")}`}>Call</a>
              </Button>
            )}
            {l.email && (
              <Button asChild variant="secondary">
                <a href={`mailto:${l.email}`}>Email</a>
              </Button>
            )}
          </>
        }
        meta={
          <>
            <span>{STAGE_LABEL[l.stage]}</span>
            <span>
              Score <span className="num text-ink-900">{l.score}</span> · {scoreBand(l.score)}
            </span>
            {l.nextActionAt && (
              <span className={cn(l.nextActionAt.getTime() < Date.now() && "text-danger")}>
                Next: {l.nextAction} · <RelativeTime iso={l.nextActionAt.toISOString()} />
              </span>
            )}
          </>
        }
      />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Section title="Stage" description="Moving a lead to Lost requires a reason; reasons feed the conversion report.">
            <LeadStage leadId={l.id} stage={l.stage} />
          </Section>
          <Section title="Qualification" description="The lead qualifier reads the score, the listing and the activity, and writes the next action and an opening line.">
            <RunAgent endpoint={`/api/leads/${l.id}/qualify`} body={{}} agentLabel="Lead qualifier" action="Qualify lead" initial={prev ? { output: prev.output as never, model: prev.model, costUsd: prev.costUsd, at: prev.at } : null} />
          </Section>
          <Section title="WhatsApp" description="Messages through the firm's WhatsApp Business number. Free text is allowed for 24 hours after the client last wrote; outside that window only approved templates can be sent.">
            {conversation ? (
              <Thread conversation={convDto(conversation)} templates={templates.map(tplDto)} />
            ) : (
              <p className="text-ui text-ink-500">No WhatsApp conversation with this lead yet. A conversation opens when the lead writes to the firm&apos;s number or receives an approved template from the inbox.</p>
            )}
          </Section>
          <Section title="Log activity" description="Calls, WhatsApp messages, emails and viewings update the last contact and the score.">
            <LogActivity leadId={l.id} />
          </Section>
          <Section title="Activity">
            <ol className="border-t border-hairline">
              {d.activities.map(({ a, user: who }) => (
                <li key={a.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 border-b border-hairline-row py-3 text-ui">
                  <span className="label-caps pt-0.5">{a.type}</span>
                  <div className="min-w-0">
                    <p className="text-ink-900">{a.summary}</p>
                    <p className="mt-0.5 text-meta text-ink-500">
                      {[who, a.outcome].filter(Boolean).join(" · ")}
                      {(who || a.outcome) && " · "}
                      <RelativeTime iso={a.occurredAt.toISOString()} />
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        </div>
        <aside className="space-y-8 lg:pt-10">
          <section aria-label="Lead details">
            <h2 className="label-caps mb-3">Details</h2>
            <dl className="border-t border-hairline">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-hairline-row py-2.5 text-ui">
                  <dt className="text-ink-500">{k}</dt>
                  <dd className="text-right text-ink-900">{v}</dd>
                </div>
              ))}
              {l.phone && (
                <div className="flex justify-between gap-4 border-b border-hairline-row py-2.5 text-ui">
                  <dt className="text-ink-500">Phone</dt>
                  <dd className="num text-ink-900">{l.phone}</dd>
                </div>
              )}
              {l.email && (
                <div className="flex justify-between gap-4 border-b border-hairline-row py-2.5 text-ui">
                  <dt className="text-ink-500">Email</dt>
                  <dd className="truncate text-ink-900">{l.email}</dd>
                </div>
              )}
            </dl>
          </section>
          <section aria-label="Score breakdown">
            <h2 className="label-caps mb-3">Score, itemised</h2>
            <ul className="border-t border-hairline">
              {l.scoreFactors.map((f) => (
                <li key={f.label} className="flex items-baseline justify-between gap-4 border-b border-hairline-row py-2.5 text-ui">
                  <span className="min-w-0">
                    <span className="text-ink-900">{f.label}</span>
                    <span className="block truncate text-meta text-ink-500">{f.detail}</span>
                  </span>
                  <span className={cn("num shrink-0", f.points < 0 ? "text-danger" : "text-ink-900")}>{f.points > 0 ? `+${f.points}` : f.points}</span>
                </li>
              ))}
              <li className="flex justify-between py-2.5 text-ui font-medium">
                <span>Total</span>
                <span className="num">{l.score}</span>
              </li>
            </ul>
          </section>
          {d.listing && (
            <section aria-label="Listing enquired about">
              <h2 className="label-caps mb-3">Enquired about</h2>
              <Link href={`/analyst/listings/${d.listing.id}`} className="block rounded-md border border-hairline bg-surface p-4 transition-[border-color] duration-150 hover:border-ink-200">
                <div className="text-ui font-medium text-ink-900">{d.listing.title}</div>
                <div className="num mt-1 text-meta text-ink-500">
                  {d.listing.reference} · {formatLocal(d.listing.price, d.listing.currency)}
                </div>
              </Link>
            </section>
          )}
          {l.lostReason && (
            <section aria-label="Lost reason">
              <h2 className="label-caps mb-3">Lost</h2>
              <p className="text-ui text-ink-700">{l.lostReason}</p>
            </section>
          )}
        </aside>
      </div>
    </PageContainer>
  );
}
