import { and, eq } from "drizzle-orm";
import { DocumentCard } from "@/components/composites/document-card";
import { DocumentUpload } from "@/components/composites/document-upload";
import { PageHeader } from "@/components/composites/page-header";
import { SettingsForm } from "@/components/composites/settings-form";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function ClientSettings() {
  const user = await requireRole(["admin", "analyst", "client"]);
  const db = await getDb();
  const [row] = await db.select().from(s.users).where(eq(s.users.id, user.id));
  const [client] = user.clientId ? await db.select().from(s.clients).where(eq(s.clients.id, user.clientId)) : [];
  const kycDocs = user.clientId ? await db.select().from(s.documents).where(and(eq(s.documents.clientId, user.clientId), eq(s.documents.type, "kyc"))) : [];
  return (
    <PageContainer>
      <PageHeader eyebrow="Account" title="Settings" />
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <SettingsForm name={user.name} email={user.email} role={user.role} title={user.title} preferences={row?.preferences ?? null} />
        </div>
        <div className="flex flex-col gap-6 xl:col-span-5">
          <Card>
            <CardHeader
              eyebrow="Know your customer"
              title="Identity verification"
              actions={client && <StatusPill tone={client.kycStatus === "verified" ? "complete" : client.kycStatus === "submitted" ? "progress" : "neutral"}>{client.kycStatus}</StatusPill>}
            />
            <CardContent>
              <p className="text-small text-ink-700">UAE AML regulations require a current passport, Emirates ID or visa, and proof of address dated within three months. Documents are reviewed by the compliance team within two business days.</p>
              <div className="mt-4">
                <DocumentUpload defaultType="kyc" types={["kyc"]} />
              </div>
              {kycDocs.length > 0 && (
                <ul className="mt-4 flex flex-col gap-3">
                  {kycDocs.map((d) => (
                    <li key={d.id}>
                      <DocumentCard doc={d} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
