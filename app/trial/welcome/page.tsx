import { and, desc, eq, inArray } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InviteTeammates } from "@/components/trial/teammates";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { MAX_TEAMMATES } from "@/lib/trial/service";
import { trialStatus } from "@/lib/trial/status";

export const metadata = { title: "Your workspace" };

export default async function TrialWelcome() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [t, seeded, journey, staff] = await Promise.all([
    trialStatus(db, user.tenantId),
    db.select({ metadata: s.trialEvents.metadata }).from(s.trialEvents).where(and(eq(s.trialEvents.tenantId, user.tenantId), eq(s.trialEvents.eventType, "workspace_seeded"))).orderBy(desc(s.trialEvents.createdAt)).limit(1),
    db.select({ id: s.deals.id }).from(s.deals).where(and(eq(s.deals.tenantId, user.tenantId), eq(s.deals.reference, "DL-0001"))).limit(1),
    db.select({ email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, user.tenantId), inArray(s.users.role, ["tenant_admin", "analyst"]))),
  ]);
  const m = (seeded[0]?.metadata ?? {}) as Record<string, number | string>;
  const teammates = Math.max(0, staff.filter((u) => !u.email.endsWith("@demo.nakhla.ai")).length - 1);
  const tour = [
    { n: 1, title: "Work the lead board", body: `${m.leads ?? 50} leads from the local portals and direct channels, scored and assigned round-robin to your three agents. Drag a card to move its stage.`, href: "/analyst/leads", cta: "Open leads" },
    { n: 2, title: "Publish a listing", body: `${m.listings ?? 30} listings with permits and photos. Each shows where it is live and what each portal reported.`, href: "/analyst/listings", cta: "Open listings" },
    { n: 3, title: "Follow one transaction end to end", body: "Mandate, Allocation Memo, offers, signed contract, closing checklist, commission and the paid invoice: one deal, every step recorded.", href: journey[0] ? `/analyst/deals/${journey[0].id}` : "/analyst/deals", cta: "Open the journey" },
    { n: 4, title: "See the commission arithmetic", body: "Three commission records with the structure applied, the split per agent and the invoice status.", href: "/admin/commissions", cta: "Open commissions" },
    { n: 5, title: "Bring your own data", body: "Import from Follow Up Boss, Salesforce, HubSpot, Zoho, Propertybase, kvCORE or a CSV file, with a dry run first and 24 hours to roll back.", href: "/admin/migrate", cta: "Start an import" },
  ];
  return (
    <PageContainer>
      <PageHeader eyebrow={t ? `Trial · ${t.daysRemaining} days remaining` : "Workspace"} title="Your workspace is ready." subtitle={`Seeded for your market${m.ms ? ` in ${(Number(m.ms) / 1000).toFixed(1)} seconds` : ""}. Five steps show how the firm runs on Nakhla; each takes under two minutes.`} />
      <ol className="my-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tour.map((x) => (
          <li key={x.n} className="flex flex-col rounded-md border border-hairline bg-surface p-6">
            <span className="num text-[12px] text-ink-500">Step {x.n}</span>
            <h2 className="mt-2 text-[18px] font-medium text-navy-900">{x.title}</h2>
            <p className="mt-2 flex-1 text-ui text-ink-700">{x.body}</p>
            <Link href={x.href} className="mt-5 inline-flex items-center gap-1.5 text-ui font-medium text-navy-900 hover:underline">
              {x.cta} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </li>
        ))}
        <li className="flex flex-col rounded-md border border-hairline bg-surface p-6 md:col-span-2 xl:col-span-1">
          <span className="num text-[12px] text-ink-500">Step 6</span>
          <h2 className="mt-2 text-[18px] font-medium text-navy-900">Invite your team</h2>
          <p className="mt-2 text-ui text-ink-700">Up to {MAX_TEAMMATES} teammates join the trial on the same fourteen-day clock.</p>
          <div className="mt-5">{user.role === "tenant_admin" ? <InviteTeammates remaining={MAX_TEAMMATES - teammates} /> : <p className="text-ui text-ink-500">Your administrator invites teammates.</p>}</div>
        </li>
      </ol>
    </PageContainer>
  );
}
