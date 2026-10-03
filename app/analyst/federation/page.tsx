import { eq, inArray, or } from "drizzle-orm";
import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { FederationStats } from "@/components/intelligence/federation-stats";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { federationStats, MIN_ADVISORIES, MIN_DEALS, tenantContribution } from "@/lib/federation";
import { getTenantById } from "@/lib/tenant";
import { scope } from "@/lib/tenant-db";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Federation" };
export const dynamic = "force-dynamic";

const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

export default async function AnalystFederation() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const props = await db.selectDistinct({ region: s.properties.region, assetClass: s.properties.assetClass, market: s.properties.market }).from(s.properties).where(scope(s.properties, user.tenantId));
  const keys = [...new Set([...props.map((p) => `segment:${p.region}:${p.assetClass}`), ...props.map((p) => `market:${p.market}`)])];
  const [baselines, stats, tenant, mine] = await Promise.all([
    keys.length ? db.select().from(s.federationBaselines).where(or(inArray(s.federationBaselines.key, keys), eq(s.federationBaselines.kind, "segment"))) : Promise.resolve([]),
    federationStats(db),
    getTenantById(user.tenantId),
    tenantContribution(db, user.tenantId),
  ]);
  const relevant = baselines.filter((b) => keys.includes(b.key)).sort((a, b) => b.deals - a.deals);
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Layer 6 · federated intelligence"
        title="Federation"
        subtitle="Anonymised learnings from completed mandates across advisories on Nakhla calibrate every underwriting and developer score. No firm sees another's deals; it sees only what the market as a whole has learned."
        meta={<FederationStats stats={stats} />}
      />
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader eyebrow="Published for your catalogue" title="Baselines" />
          <CardContent>
            {relevant.length === 0 ? (
              <p className="text-small text-ink-500">No baseline is published for your segments yet. Each needs at least {MIN_DEALS} deals from {MIN_ADVISORIES} advisories.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-small">
                  <thead>
                    <tr className="label-caps h-8 border-b border-hairline text-start">
                      <th className="py-2 font-normal">Segment</th>
                      <th className="py-2 text-right font-normal">Deals</th>
                      <th className="py-2 text-right font-normal">Gross yield</th>
                      <th className="py-2 text-right font-normal">Capital growth</th>
                      <th className="py-2 text-right font-normal">Vacancy</th>
                      <th className="py-2 text-right font-normal">P50 IRR</th>
                      <th className="py-2 pl-4 font-normal">Most frequent serious finding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline-row">
                    {relevant.map((b) => (
                      <tr key={b.key}>
                        <td className="py-2.5 text-ink-900">{b.region ? `${b.region} ${b.assetClass}` : `${b.market} (all)`}</td>
                        <td className="num py-2.5 text-right text-ink-900">
                          {b.deals}
                          <span className="text-ink-500"> / {b.advisories}</span>
                        </td>
                        <td className="num py-2.5 text-right">{pc(b.data.medians.grossYield)}</td>
                        <td className="num py-2.5 text-right">{pc(b.data.medians.capitalGrowth)}</td>
                        <td className="num py-2.5 text-right">{pc(b.data.medians.vacancy)}</td>
                        <td className="num py-2.5 text-right">{b.data.irr.p50}%</td>
                        <td className="py-2.5 pl-4 text-ink-700">{b.data.topRisks[0] ? `${b.data.topRisks[0].category} (${Math.round(b.data.topRisks[0].share * 100)}%)` : "None"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardHeader eyebrow="Your firm" title="Participation" />
            <CardContent>
              <div className="flex items-center gap-3">
                <StatusPill tone={tenant?.consentFederation ? "complete" : "neutral"}>{tenant?.consentFederation ? "Contributing" : "Not contributing"}</StatusPill>
                <span className="text-small text-ink-500">
                  <span className="num text-ink-900">{mine}</span> anonymised learnings in the pool
                </span>
              </div>
              <p className="mt-3 text-small text-ink-700">Every firm benefits from published baselines. Contributing firms add their delivered mandates, which makes the baselines for their own segments arrive sooner.</p>
              {user.role === "tenant_admin" && (
                <Link href="/admin/insights-config" className="mt-3 inline-block text-small text-navy-900 underline decoration-ink-200 underline-offset-4">
                  Change participation
                </Link>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader eyebrow="How it works" title="What leaves your workspace" />
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-small text-ink-700">
                <li>On delivery, the platform extracts the segment, ticket band, assumptions, simulated returns, verdict and the categories of serious findings.</li>
                <li>Property, developer, mandate and firm become salted one-way hashes. No names, prices, clients or text leave.</li>
                <li>Each night the learnings are aggregated. A baseline is published only above {MIN_DEALS} deals from {MIN_ADVISORIES} firms.</li>
                <li>Underwriting and developer risk agents read the baselines as calibration evidence.</li>
              </ol>
              {stats.lastRunAt && <p className="mt-3 text-small text-ink-500">Last aggregation {formatDate(stats.lastRunAt)}.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
