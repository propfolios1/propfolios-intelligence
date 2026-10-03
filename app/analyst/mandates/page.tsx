import Link from "next/link";
import { Suspense } from "react";
import { MandatesView } from "@/components/composites/mandate/mandates-view";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { listClients, listMandates } from "@/lib/queries";
import { mandateRows } from "@/lib/serialize";

export const metadata = { title: "Mandates" };
export const dynamic = "force-dynamic";

export default async function MandatesPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [rows, clients] = await Promise.all([listMandates(db, user), listClients(db, user)]);
  const open = rows.filter((r) => r.status !== "DELIVERED").length;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Pipeline"
        title="Mandates"
        subtitle={`${rows.length} mandates across ${clients.length} clients; ${open} open. Drag a card back to re-open a stage.`}
        actions={
          <Button asChild>
            <Link href="/analyst/mandates/new">Create mandate</Link>
          </Button>
        }
      />
      <Suspense>
        <MandatesView rows={mandateRows(rows)} clients={clients.map((c) => ({ id: c.id, name: c.name }))} />
      </Suspense>
    </PageContainer>
  );
}
