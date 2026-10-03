import { asc } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { DeactivateStructure, StructureEditor, type StructureView } from "@/components/commission/structure-editor";
import { Flag } from "@/components/os/badges";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ensureDefaultStructures } from "@/lib/commission/service";
import { JURISDICTION_LABEL, DEAL_TYPE_LABEL } from "@/lib/deals/domain";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Commission structures" };
export const dynamic = "force-dynamic";

export default async function Structures() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  await ensureDefaultStructures(db, user.tenantId);
  const rows = await db.select().from(s.commissionStructures).where(scope(s.commissionStructures, user.tenantId)).orderBy(asc(s.commissionStructures.createdAt));
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Commissions" title="Commission structures" subtitle="Rates, tiers, payer and splits. The most specific active structure that matches a closing deal applies; the default covers the rest." actions={<StructureEditor trigger="New structure" />} />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {rows.map((r) => (
          <article key={r.id} className="rounded-md border border-hairline bg-surface p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-display text-section text-navy-900">{r.name}</div>
                <div className="mt-1 text-small text-ink-700">
                  {r.type === "percentage" ? `${r.ratePct}% of value` : r.type === "fixed" ? `Fixed ${r.currency} ${r.fixedAmount?.toLocaleString("en-US")}` : r.tiers.map((t) => `${t.ratePct}% ${t.upTo === null ? "above" : `to ${t.upTo.toLocaleString("en-US")}`}`).join(", ")} · paid by the {r.payer}
                </div>
              </div>
              <div className="flex gap-2">
                {r.isDefault && <Flag tone="progress">Default</Flag>}
                <Flag tone={r.active ? "complete" : "neutral"}>{r.active ? "Active" : "Inactive"}</Flag>
              </div>
            </div>
            <div className="mt-4 text-small text-ink-700">
              Applies to {r.appliesTo.jurisdictions?.length ? r.appliesTo.jurisdictions.map((j) => JURISDICTION_LABEL[j]).join(", ") : "every jurisdiction"}
              {r.appliesTo.dealTypes?.length ? `; ${r.appliesTo.dealTypes.map((d) => DEAL_TYPE_LABEL[d].toLowerCase()).join(", ")}` : ""}
              {r.appliesTo.minValue ? `; deals of AED ${r.appliesTo.minValue.toLocaleString("en-US")} and above` : ""}.
            </div>
            <div className="mt-4 flex h-2 overflow-hidden rounded-full">
              {r.splits.map((x, i) => (
                <div key={i} style={{ width: `${x.pct}%`, background: ["var(--navy-900)", "var(--navy-700)", "var(--gold-500)", "var(--ink-400)"][i % 4] }} />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 text-axis text-ink-700">
              {r.splits.map((x, i) => (
                <span key={i}>
                  {x.label} <span className="num">{x.pct}%</span>
                </span>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <StructureEditor trigger="Edit" initial={{ ...r, currency: r.currency as StructureView["currency"], appliesTo: r.appliesTo }} />
              {r.active && <DeactivateStructure id={r.id} />}
            </div>
          </article>
        ))}
      </div>
    </PageContainer>
  );
}
