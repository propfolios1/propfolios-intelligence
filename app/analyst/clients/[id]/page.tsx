import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientActions } from "@/components/composites/client-actions";
import { MessageThread } from "@/components/composites/message-thread";
import { PageHeader } from "@/components/composites/page-header";
import { PortfolioView } from "@/components/composites/portfolio-view";
import { RecommendationPill, StagePill } from "@/components/composites/status";
import { Crumb } from "@/components/shell/crumb";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDb } from "@/db";
import { HttpError, requireRole } from "@/lib/auth";
import { formatAed } from "@/lib/domain";
import { getPortfolio, listMandates, listMessages } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["admin", "analyst"]);
  const { id } = await params;
  const db = await getDb();
  let p;
  try {
    p = await getPortfolio(db, user, id);
  } catch (e) {
    if (e instanceof HttpError) notFound();
    throw e;
  }
  const [mandates, messages] = await Promise.all([listMandates(db, user, { clientId: id }), listMessages(db, user, id)]);
  return (
    <PageContainer>
      <Crumb segment={id} label={p.client.name} />
      <PageHeader eyebrow={`${p.client.type} · ${p.client.nationality} · ${p.client.residency}`} title={p.client.name} subtitle={`AUM ${formatAed(p.client.aumAed)}. KYC ${p.client.kycStatus}.${p.client.policy.notes ? ` ${p.client.policy.notes}` : ""}`} actions={<ClientActions clientId={id} />} rule={false} />
      <div className="mt-8">
        <PortfolioView p={p} recommendationsHref="/analyst/clients" />
      </div>
      <section className="mt-10 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <CardHeader eyebrow="Advisory" title="Mandates" />
          <CardContent>
            {mandates.length === 0 && <p className="text-small text-ink-500">No mandates for this client.</p>}
            <ul className="divide-y divide-ink-200">
              {mandates.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/analyst/mandates/${m.id}`} className="min-w-0 hover:underline">
                    <span className="num text-small text-ink-500">{m.reference}</span> <span className="text-ui text-ink-900">{m.title}</span>
                  </Link>
                  <span className="flex shrink-0 gap-2">
                    <StagePill status={m.status} />
                    {m.recommendation && <RecommendationPill value={m.recommendation} />}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="xl:col-span-7">
          <div className="eyebrow mb-3">Messages</div>
          <MessageThread clientId={id} viewerIsClient={false} viewerName={user.name} initial={messages.map((m) => ({ id: m.id, authorName: m.authorName, authorRole: m.authorRole, body: m.body, createdAt: m.createdAt.toISOString() }))} />
        </div>
      </section>
    </PageContainer>
  );
}
