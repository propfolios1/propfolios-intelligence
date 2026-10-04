import Link from "next/link";
import { asc } from "drizzle-orm";
import { PresetGallery } from "@/components/commission/calculator";
import { PageHeader } from "@/components/composites/page-header";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { configFromStructure } from "@/lib/commission/calc-service";
import { calculate, formatMinor, MARKET_TAX } from "@/lib/commission/calculator";
import { ensureDefaultStructures } from "@/lib/commission/service";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Commission structures" };
export const dynamic = "force-dynamic";

const SAMPLE = "2500000";

export default async function CommissionStructures() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  await ensureDefaultStructures(db, user.tenantId);
  const rows = await db.select().from(s.commissionStructures).where(scope(s.commissionStructures, user.tenantId)).orderBy(asc(s.commissionStructures.createdAt));
  const currency = "AED";
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Commissions" title="Commission structures" subtitle="Each structure defines who pays, how the fee is calculated, what comes off the top, how the firm and its agents share the rest, and the tax on the invoice. Figures are computed to the cent with the same engine the deal calculator uses." />
      <Section title="Structures" description={`Worked on a sample price of ${formatMinor(BigInt(SAMPLE) * 100n, currency)}.`}>
        <ul className="grid gap-4 lg:grid-cols-2">
          {rows.map((r) => {
            const cfg = configFromStructure(r, currency, MARKET_TAX.AED!);
            const res = calculate(SAMPLE, cfg);
            return (
              <li key={r.id}>
                <Link href={`/admin/commission-structures/${r.id}`} className="block rounded-md border border-hairline bg-surface p-5 transition-[border-color] duration-150 hover:border-ink-200">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="font-display text-section text-navy-900">{r.name}</div>
                    <div className="flex gap-2">
                      {r.isDefault && <StatusPill tone="progress">Default</StatusPill>}
                      <StatusPill tone={r.active ? "complete" : "neutral"}>{r.active ? "Active" : "Inactive"}</StatusPill>
                    </div>
                  </div>
                  <dl className="num mt-4 grid grid-cols-3 gap-3 text-[13px]">
                    <div>
                      <dt className="label-caps">Gross</dt>
                      <dd className="mt-1 text-ink-900">{formatMinor(res.gross, currency)}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Firm</dt>
                      <dd className="mt-1 text-ink-900">{formatMinor(res.firm, currency)}</dd>
                    </div>
                    <div>
                      <dt className="label-caps">Agents</dt>
                      <dd className="mt-1 text-ink-900">{formatMinor(res.agentPool, currency)}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-[13px] text-ink-700">
                    {cfg.fees.map((f) => `${f.method === "percentage" ? `${f.ratePct}%` : f.method === "fixed" ? "fixed fee" : "tiered"} from the ${f.payer}`).join(" and ")}
                    {cfg.deductions?.length ? `; ${cfg.deductions.map((d) => d.label.toLowerCase()).join(", ")} off the top` : ""}; agents {cfg.agentSplitPct}%
                    {cfg.team?.length ? ` across ${cfg.team.length} ${cfg.team.length === 1 ? "person" : "people"}` : ""}.
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Start a new structure" description="Each preset opens in the editor as an inactive structure; adjust it, then activate it from the structure list in Commissions.">
        <PresetGallery currency={currency} />
      </Section>
    </PageContainer>
  );
}
