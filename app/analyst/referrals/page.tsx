import { asc, desc, eq } from "drizzle-orm";
import Link from "next/link";
import { CreateReferral } from "@/components/brokerage/actions";
import { marketOptions } from "@/components/brokerage/market-options";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { STAGE_LABEL } from "@/lib/brokerage/leads";
import { formatLocal } from "@/lib/format";
import { scope } from "@/lib/tenant-db";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Referrals" };
export const dynamic = "force-dynamic";

const TONE = { received: "progress", contacted: "progress", converted: "complete", rewarded: "complete", declined: "neutral" } as const;

export default async function ReferralsPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [rows, clients] = await Promise.all([
    db.select({ r: s.referrals, stage: s.leads.stage }).from(s.referrals).leftJoin(s.leads, eq(s.leads.id, s.referrals.leadId)).where(scope(s.referrals, user.tenantId)).orderBy(desc(s.referrals.createdAt)),
    db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(scope(s.clients, user.tenantId)).orderBy(asc(s.clients.name)),
  ]);
  const converted = rows.filter((x) => x.r.status === "converted" || x.r.status === "rewarded");
  const rewards = rows.filter((x) => x.r.status === "rewarded").reduce((a, x) => a + (x.r.rewardAmount ?? 0), 0);
  const cur = rows[0]?.r.currency ?? "AED";
  const referrers = new Set(rows.map((x) => x.r.referrerClientId).filter(Boolean)).size;
  return (
    <PageContainer>
      <PageHeader eyebrow="Brokerage" title="Referrals" subtitle="Introductions from clients after completion. Each referral opens a lead from the referral source, which carries the highest source weight in lead scoring." actions={<CreateReferral clients={clients} markets={marketOptions()} />} />
      <section className="my-8 stat-row">
        <StatCard label="Referrals" value={String(rows.length)} note={`From ${referrers} clients`} />
        <StatCard label="Converted" value={String(converted.length)} note={rows.length ? `${Math.round((converted.length / rows.length) * 100)}% of referrals` : "None"} />
        <StatCard label="Rewards paid" value={formatLocal(rewards, cur)} note="Recorded against the referrer" />
      </section>
      <SimpleTable
        rows={rows}
        minWidth={900}
        empty="No referrals yet."
        columns={[
          { key: "f", header: "Referred by", cell: (x) => x.r.referrerName },
          { key: "n", header: "Referred", cell: (x) => (x.r.leadId ? <Link href={`/analyst/leads/${x.r.leadId}`} className="text-ink-900 hover:underline">{x.r.referredName}</Link> : x.r.referredName) },
          { key: "s", header: "Status", cell: (x) => <Flag tone={TONE[x.r.status]}>{x.r.status}</Flag> },
          { key: "l", header: "Lead stage", cell: (x) => (x.stage ? STAGE_LABEL[x.stage] : "No lead yet") },
          { key: "rw", header: "Reward", numeric: true, cell: (x) => (x.r.rewardAmount && x.r.currency ? formatLocal(x.r.rewardAmount, x.r.currency) : "None") },
          { key: "nt", header: "Notes", cell: (x) => x.r.notes ?? "None" },
          { key: "d", header: "Received", cell: (x) => formatDate(x.r.createdAt) },
        ]}
      />
    </PageContainer>
  );
}
