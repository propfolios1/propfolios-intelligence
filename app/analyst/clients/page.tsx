import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { PageContainer } from "@/components/shell/page-container";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { formatAed } from "@/lib/domain";
import { listClients } from "@/lib/queries";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const clients = await listClients(await getDb(), user);
  const aum = clients.reduce((a, c) => a + c.aumAed, 0);
  const value = clients.reduce((a, c) => a + c.valueAed, 0);
  return (
    <PageContainer>
      <PageHeader eyebrow="Relationships" title="Clients" subtitle="Families and individuals under advice, their real estate holdings and open mandates." />
      <section className="mt-8 stat-row">
        <StatCard label="Assets under advice" value={formatAed(aum)} />
        <StatCard label="Real estate held" value={formatAed(value)} note={`${clients.reduce((a, c) => a + c.holdings, 0)} holdings`} />
        <StatCard label="Active mandates" value={String(clients.reduce((a, c) => a + c.activeMandates, 0))} />
      </section>
      <ul className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {clients.map((c) => (
          <li key={c.id}>
            <Card interactive className="relative p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">{c.type}</div>
                  <h2 className="mt-2 font-display text-read text-navy-900">
                    <Link href={`/analyst/clients/${c.id}`} className="after:absolute after:inset-0">
                      {c.name}
                    </Link>
                  </h2>
                  <p className="text-small text-ink-500">
                    {c.nationality} · {c.residency}
                  </p>
                </div>
                <StatusPill tone={c.kycStatus === "verified" ? "complete" : "progress"}>KYC {c.kycStatus}</StatusPill>
              </div>
              <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-hairline pt-4">
                <div>
                  <dt className="text-axis text-ink-500">AUM</dt>
                  <dd className="num text-small text-ink-900">{formatAed(c.aumAed)}</dd>
                </div>
                <div>
                  <dt className="text-axis text-ink-500">Real estate</dt>
                  <dd className="num text-small text-ink-900">{formatAed(c.valueAed)}</dd>
                </div>
                <div>
                  <dt className="text-axis text-ink-500">Mandates</dt>
                  <dd className="num text-small text-ink-900">{c.activeMandates} open</dd>
                </div>
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </PageContainer>
  );
}
