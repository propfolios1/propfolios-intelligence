import { DocumentsGrid } from "@/components/documents-grid";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { getMandateView, listDocuments } from "@/lib/data/store";

export const metadata = { title: "Documents" };

export default function ClientDocuments() {
  const docs = listDocuments();
  const subtitles = Object.fromEntries(docs.map((d) => [d.id, d.mandateId ? `${d.mandateId} · ${getMandateView(d.mandateId)?.property.community ?? ""}` : ""]));
  return (
    <PageContainer>
      <PageHeader eyebrow="Vault" title="Documents" subtitle="Memos, contracts, valuations and statements across your mandates." />
      <DocumentsGrid docs={docs} subtitles={subtitles} />
    </PageContainer>
  );
}
