import Link from "next/link";
import { Suspense } from "react";
import { MandatesView } from "@/components/composites/mandate/mandates-view";
import { PageHeader } from "@/components/composites/page-header";
import { Button } from "@/components/primitives/button";
import { PageContainer } from "@/components/shell/page-container";
import { clients, listMandateRows } from "@/lib/data/store";

export const metadata = { title: "Mandates" };
export const dynamic = "force-dynamic";

export default function MandatesPage() {
  const rows = listMandateRows();
  const open = rows.filter((r) => r.status !== "delivered").length;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pipeline"
        title="Mandates"
        subtitle={`${rows.length} mandates across ${clients.length} clients. ${open} open.`}
        actions={
          <Button asChild>
            <Link href="/analyst/mandates?new=1" scroll={false}>
              New mandate
            </Link>
          </Button>
        }
      />
      <Suspense>
        <MandatesView rows={rows} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </Suspense>
    </PageContainer>
  );
}
