import Link from "next/link";
import { desc } from "drizzle-orm";
import { FirmVariables, NewTemplate } from "@/components/contracts/contracts";
import { PageHeader } from "@/components/composites/page-header";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { firmVariables, listTemplates } from "@/lib/contracts/service";
import { JURISDICTION_NAME } from "@/lib/contracts/templates";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Contract templates" };
export const dynamic = "force-dynamic";

export default async function Templates() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const [list, vars, recent] = await Promise.all([listTemplates(db, user.tenantId), firmVariables(db, user.tenantId), db.select().from(s.contractInstances).where(scope(s.contractInstances, user.tenantId)).orderBy(desc(s.contractInstances.createdAt)).limit(200)]);
  const used = new Map<string, number>();
  for (const r of recent) used.set(r.templateId, (used.get(r.templateId) ?? 0) + 1);
  const groups = (["AE", "IN", "GB", "SG", "ANY"] as const).map((j) => ({ j, items: list.filter((t) => t.current.jurisdiction === j) })).filter((g) => g.items.length);
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Contracts" title="Contract templates" subtitle="Templates by jurisdiction with variables, conditional clauses and versions. Deals draft from the published version; every draft records the version it came from." actions={<NewTemplate templates={list.map((t) => ({ id: t.current.id, name: t.current.name }))} />} />
      {groups.map((g) => (
        <Section key={g.j} title={JURISDICTION_NAME[g.j]}>
          <ul className="grid gap-3 lg:grid-cols-2">
            {g.items.map(({ family, current, published, draft, versions }) => (
              <li key={family}>
                <Link href={`/admin/contracts/templates/${current.id}`} className="block h-full rounded-md border border-hairline bg-surface p-5 transition-[border-color] duration-150 hover:border-ink-200">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="text-ui font-medium text-ink-900">{current.name}</div>
                    <div className="flex gap-2">
                      {published && <StatusPill tone="complete">Version {published.version}</StatusPill>}
                      {draft && <StatusPill tone="progress">Draft {draft.version}</StatusPill>}
                    </div>
                  </div>
                  <p className="mt-2 text-[13px] text-ink-700">{current.description}</p>
                  <p className="mt-3 text-[12px] text-ink-500">
                    {versions} {versions === 1 ? "version" : "versions"} · {published ? <>published <RelativeTime iso={(published.publishedAt ?? published.createdAt).toISOString()} /></> : "not published"} · {[...used.entries()].filter(([id]) => id === published?.id).reduce((a, [, n]) => a + n, 0)} recent drafts
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ))}
      <Section title="Firm variables" description="Values every template can use, such as licence and registration numbers. Set once here instead of in each contract.">
        <div className="max-w-[860px] rounded-md border border-hairline bg-surface p-5">
          <FirmVariables variables={vars.map((v) => ({ path: v.path, label: v.label, value: v.value }))} />
        </div>
      </Section>
    </PageContainer>
  );
}
