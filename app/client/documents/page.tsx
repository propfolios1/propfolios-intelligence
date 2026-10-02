import { and, eq } from "drizzle-orm";
import { DocumentCard } from "@/components/composites/document-card";
import { DocumentUpload } from "@/components/composites/document-upload";
import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { DOC_TYPE_LABEL } from "@/lib/domain";
import { listDocuments } from "@/lib/queries";

export const metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function ClientDocuments() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const db = await getDb();
  const docs = user.clientId ? await listDocuments(db, user, { clientId: user.clientId }) : [];
  const memos = user.clientId
    ? await db
        .select({ id: s.memos.id, mandateId: s.memos.mandateId })
        .from(s.memos)
        .innerJoin(s.mandates, eq(s.mandates.id, s.memos.mandateId))
        .where(and(eq(s.mandates.clientId, user.clientId), eq(s.memos.status, "delivered")))
    : [];
  const memoFor = new Map(memos.map((m) => [m.mandateId, m.id]));
  const types = [...new Set(docs.map((d) => d.type))];
  return (
    <PageContainer>
      <PageHeader eyebrow="Vault" title="Documents" subtitle={`${docs.length} memos, agreements, valuations and statements.`} />
      <div className="mt-8 grid grid-cols-1 gap-8 xl:grid-cols-12">
        <div className="xl:col-span-9">
          {docs.length === 0 && <EmptyState glyph="documents" headline="No documents yet." />}
          {types.map((t) => (
            <section key={t} className="mb-10">
              <h2 className="eyebrow mb-3">{DOC_TYPE_LABEL[t] ?? t}</h2>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {docs
                  .filter((d) => d.type === t)
                  .map((d) => {
                    const memoId = d.type === "memo" && d.mandateId ? memoFor.get(d.mandateId) : undefined;
                    return (
                      <li key={d.id}>
                        <DocumentCard doc={d} href={memoId ? `/api/memos/${memoId}/export` : undefined} />
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
        <aside className="xl:col-span-3">
          <h2 className="eyebrow mb-3">Upload</h2>
          <DocumentUpload defaultType="statement" />
        </aside>
      </div>
    </PageContainer>
  );
}
