import Link from "next/link";
import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/contracts/contracts";
import { PageHeader } from "@/components/composites/page-header";
import { Section } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { RelativeTime } from "@/components/ui/relative-time";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { getTemplate } from "@/lib/contracts/service";
import { JURISDICTION_NAME } from "@/lib/contracts/templates";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Contract template" };
export const dynamic = "force-dynamic";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const r = await getTemplate(db, user.tenantId, id).catch(() => null);
  if (!r) notFound();
  const { template: t, versions } = r;
  const deals = await db.select({ id: s.deals.id, reference: s.deals.reference, title: s.deals.title }).from(s.deals).where(scope(s.deals, user.tenantId)).orderBy(desc(s.deals.createdAt)).limit(40);
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Link href="/admin/contracts/templates">Contract templates · {JURISDICTION_NAME[t.jurisdiction]}</Link>}
        title={t.name}
        subtitle={t.description}
        meta={
          <>
            <StatusPill tone={t.status === "published" ? "complete" : t.status === "draft" ? "progress" : "neutral"}>{t.status}</StatusPill>
            <span className="num">Version {t.version}</span>
          </>
        }
      />
      <p className="mt-6 max-w-[90ch] rounded-md border border-hairline bg-surface p-4 text-[13px] text-ink-700">{t.officialNote}</p>
      <div className="mt-8">
        <TemplateEditor key={t.id} t={{ id: t.id, name: t.name, description: t.description, body: t.body, inputs: t.inputs, status: t.status, version: t.version, officialNote: t.officialNote }} deals={deals.map((d) => ({ id: d.id, label: `${d.reference} · ${d.title}` }))} readOnly={t.status === "archived"} />
      </div>
      <Section title="Versions">
        <ul className="divide-y divide-hairline-row rounded-md border border-hairline bg-surface">
          {versions.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-ui">
              <Link href={`/admin/contracts/templates/${v.id}`} className={v.id === t.id ? "text-ink-900" : "text-ink-700 underline-offset-4 hover:underline"}>
                Version {v.version}
                {v.changeNote ? `: ${v.changeNote}` : ""}
              </Link>
              <span className="flex items-center gap-3 text-[12px] text-ink-500">
                {v.publishedAt && <RelativeTime iso={v.publishedAt.toISOString()} />}
                <StatusPill tone={v.status === "published" ? "complete" : v.status === "draft" ? "progress" : "neutral"}>{v.status}</StatusPill>
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </PageContainer>
  );
}
