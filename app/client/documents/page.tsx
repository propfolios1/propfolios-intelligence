import { DocumentsGrid } from "@/components/composites/documents-grid";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { getMandateView, listDocuments } from "@/lib/data/store";

export const metadata = { title: "Documents" };

export default function ClientDocuments() {
  const docs = listDocuments();
  const subtitles = Object.fromEntries(docs.map((d) => [d.id, d.mandateId ? `${d.mandateId}, ${getMandateView(d.mandateId)?.property.community ?? ""}` : ""]));
  return (
    <PageContainer>
      <PageHeader eyebrow="Vault" title="Documents" subtitle={`${docs.length} memos, contracts, valuations and statements.`} />
      <DocumentsGrid docs={docs} subtitles={subtitles} />
    </PageContainer>
  );
}
