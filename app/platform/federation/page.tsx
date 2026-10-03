import { desc, eq } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { FederationRunButton } from "@/components/platform/federation-run";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { anonymise, federationStats, MIN_ADVISORIES, MIN_DEALS } from "@/lib/federation";
import { requirePlatformAdmin } from "@/lib/require-platform";
import { formatDate, relativeTime } from "@/lib/utils";

export const metadata = { title: "Federation" };
export const dynamic = "force-dynamic";

const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

export default async function PlatformFederation() {
  await requirePlatformAdmin();
  const db = await getDb();
  const [stats, baselines, runs, tenants, learnings] = await Promise.all([
    federationStats(db),
    db.select().from(s.federationBaselines).orderBy(desc(s.federationBaselines.deals)),
    db.select().from(s.federationRuns).orderBy(desc(s.federationRuns.createdAt)).limit(10),
    db.select({ id: s.tenants.id, name: s.tenants.name, consent: s.tenants.consentFederation, cfg: s.tenants.configJson }).from(s.tenants).where(eq(s.tenants.consentFederation, true)),
    db.select({ contributor: s.federationLearnings.contributorHash, quarter: s.federationLearnings.deliveredQuarter }).from(s.federationLearnings),
  ]);
  const byHash = new Map<string, number>();
  for (const l of learnings) byHash.set(l.contributor, (byHash.get(l.contributor) ?? 0) + 1);
  const segments = baselines.filter((b) => b.kind === "segment");
  const developers = baselines.filter((b) => b.kind === "developer");
  return (
    <PageContainer>
      <PageHeader eyebrow="Layer 6" title="Federated intelligence" subtitle={`Anonymised learnings pooled across consenting advisories. Baselines publish at ${MIN_DEALS} or more deals from ${MIN_ADVISORIES} or more firms.`} actions={<FederationRunButton />} />
      <section className="mt-8 stat-row">
        <StatCard label="Learnings" value={String(stats.deals)} note="Delivered mandates, anonymised" />
        <StatCard label="Contributing advisories" value={String(stats.advisories)} note={`${tenants.length} firms opted in`} />
        <StatCard label="Published baselines" value={String(stats.baselines)} note={`${segments.length} segments, ${developers.length} developers`} />
        <StatCard label="Last aggregation" value={stats.lastRunAt ? relativeTime(stats.lastRunAt) : "Never"} note="Nightly at 02:00 Gulf time" />
      </section>
      <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <CardHeader eyebrow="Published" title="Segment baselines" />
          <CardContent>
            {segments.length === 0 ? (
              <p className="text-small text-ink-500">Nothing meets the anonymity threshold yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-small">
                  <thead>
                    <tr className="label-caps h-8 border-b border-hairline text-start">
                      <th className="py-2 font-normal">Segment</th>
                      <th className="py-2 text-right font-normal">Deals / firms</th>
                      <th className="py-2 text-right font-normal">Yield</th>
                      <th className="py-2 text-right font-normal">Growth</th>
                      <th className="py-2 text-right font-normal">P50 IRR (IQR)</th>
                      <th className="py-2 text-right font-normal">Serious findings</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline-row">
                    {segments.map((b) => (
                      <tr key={b.key}>
                        <td className="py-2.5 text-ink-900">{b.region ? `${b.region} ${b.assetClass}` : `${b.market} (all)`}</td>
                        <td className="num py-2.5 text-right">
                          {b.deals} / {b.advisories}
                        </td>
                        <td className="num py-2.5 text-right">{pc(b.data.medians.grossYield)}</td>
                        <td className="num py-2.5 text-right">{pc(b.data.medians.capitalGrowth)}</td>
                        <td className="num py-2.5 text-right">
                          {b.data.irr.p50}% ({b.data.irr.p25} to {b.data.irr.p75})
                        </td>
                        <td className="num py-2.5 text-right">{Math.round(b.data.highSeverityRate * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {developers.length > 0 && (
              <>
                <div className="eyebrow mt-8">Developer signals (hashed)</div>
                <ul className="mt-3 divide-y divide-hairline border-y border-hairline">
                  {developers.map((b) => (
                    <li key={b.key} className="flex items-center justify-between gap-4 py-2.5 text-small">
                      <code className="num text-ink-500">{b.developerHash?.slice(0, 12)}…</code>
                      <span className="text-ink-700">
                        {b.deals} deals · {Math.round(b.data.highSeverityRate * 100)}% with serious findings · {Math.round((b.data.recommendationMix.Decline ?? 0) * 100)}% declined
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-6 xl:col-span-4">
          <Card>
            <CardHeader eyebrow="Consent" title="Contributing firms" />
            <CardContent>
              <ul className="divide-y divide-hairline">
                {tenants
                  .filter((t) => !t.cfg.platform)
                  .map((t) => (
                    <li key={t.id} className="flex justify-between py-2 text-small">
                      <span className="text-ink-900">{t.name}</span>
                      <span className="num text-ink-500">{byHash.get(anonymise("tenant", t.id)) ?? 0} learnings</span>
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader eyebrow="History" title="Aggregation runs" />
            <CardContent>
              <ul className="divide-y divide-hairline">
                {runs.map((r) => (
                  <li key={r.id} className="py-2 text-small">
                    <div className="flex justify-between">
                      <span className="text-ink-900">{formatDate(r.createdAt)}</span>
                      <span className="num text-ink-500">{r.durationMs} ms</span>
                    </div>
                    <div className="text-ink-500">
                      {r.learnings} learnings → {r.baselines} baselines ({r.suppressed} suppressed) · {r.triggeredBy}
                    </div>
                  </li>
                ))}
                {runs.length === 0 && <li className="py-2 text-small text-ink-500">No runs yet.</li>}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageContainer>
  );
}
