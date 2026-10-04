import { desc } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { SaveAudience } from "@/components/marketing/automation";
import { MarketingTabs } from "@/components/marketing/tabs";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { audienceCount } from "@/lib/marketing/audience";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Audiences" };
export const dynamic = "force-dynamic";

const INTENT = { buy: "buyers", invest: "investors", rent: "tenants", sell: "sellers", let: "landlords" } as const;

export default async function Audiences() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const rows = await db.select().from(s.audiences).where(scope(s.audiences, user.tenantId)).orderBy(desc(s.audiences.updatedAt));
  const counts = await Promise.all(rows.map((a) => audienceCount(db, user.tenantId, a.filter)));
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Marketing" title="Audiences" subtitle="Saved groups of leads, recounted every time they are used. Consent and open status are always required." />
      <MarketingTabs active="/admin/marketing/audiences" />
      <Section title="New audience">
        <SaveAudience />
      </Section>
      <Section title="Saved">
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((a, i) => (
            <li key={a.id} className="rounded-md border border-hairline bg-surface p-4">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-ui font-medium text-ink-900">{a.name}</span>
                <span className="num text-[20px] text-navy-900">{counts[i]!.n}</span>
              </div>
              <p className="mt-1 text-[13px] text-ink-700">
                {[a.filter.intents?.length ? a.filter.intents.map((x) => INTENT[x]).join(", ") : "All intents", a.filter.budgetMin || a.filter.budgetMax ? `budget ${a.filter.budgetMin?.toLocaleString("en-US") ?? "any"} to ${a.filter.budgetMax?.toLocaleString("en-US") ?? "any"}` : null, a.filter.locations?.length ? a.filter.locations.join(", ") : null, a.filter.scoreMin ? `score ${a.filter.scoreMin}+` : null].filter(Boolean).join(" · ")}
              </p>
              <p className="num mt-1 text-[12px] text-ink-500">
                {counts[i]!.email} with email · {counts[i]!.phone} with phone
              </p>
            </li>
          ))}
          {!rows.length && <li className="text-ui text-ink-500">No saved audiences yet.</li>}
        </ul>
      </Section>
    </PageContainer>
  );
}
