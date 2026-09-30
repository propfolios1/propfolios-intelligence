import { Suspense } from "react";
import { MandatesView } from "@/components/mandates/mandates-view";
import { PageContainer } from "@/components/shell/page-container";
import { PageHeader } from "@/components/page-header";
import { NewMandateButton } from "@/components/mandates/new-mandate-button";
import { clients, listMandateRows } from "@/lib/data/store";

export const metadata = { title: "Mandates" };
export const dynamic = "force-dynamic";

export default function MandatesPage() {
  const rows = listMandateRows();
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pipeline"
        title="Mandates"
        subtitle="Every client mandate, from intake to delivered memo."
        actions={<NewMandateButton />}
      />
      <Suspense>
        <MandatesView rows={rows} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </Suspense>
    </PageContainer>
  );
}
