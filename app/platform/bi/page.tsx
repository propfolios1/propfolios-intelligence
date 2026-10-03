import { asc, eq, sql } from "drizzle-orm";
import { BiJob } from "@/components/bi/bi-actions";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { AgentOutput } from "@/components/os/agent-output";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { StructuredDetail } from "@/components/os/structured-detail";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { lastOutput } from "@/lib/ai/agents/define";
import { MIN_FIRMS, MIN_OBSERVATIONS } from "@/lib/bi/metrics";
import { DATA_PRODUCTS, ensureDataProducts } from "@/lib/bi/service";
import { formatLocal } from "@/lib/format";
import { requirePlatformAdmin } from "@/lib/require-platform";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Business intelligence" };
export const dynamic = "force-dynamic";

export default async function PlatformBi() {
  const user = await requirePlatformAdmin();
  const db = await getDb();
  const [products, bench, subs, firms] = await Promise.all([
    ensureDataProducts(db),
    db.select().from(s.benchmarks).orderBy(asc(s.benchmarks.category), asc(s.benchmarks.region)),
    db.select({ productId: s.dataSubscriptions.dataProductId, n: sql<number>`count(*)::int` }).from(s.dataSubscriptions).where(eq(s.dataSubscriptions.status, "active")).groupBy(s.dataSubscriptions.dataProductId),
    db.select({ n: sql<number>`count(*)::int` }).from(s.tenants).where(eq(s.tenants.consentFederation, true)),
  ]);
  const review = await lastOutput<{ headline: string; points: { label: string; detail: string }[]; confidence: number }>(user.tenantId, "benchmark-computer", null);
  const mrr = products.reduce((a, p) => a + (subs.find((x) => x.productId === p.id)?.n ?? 0) * (p.billing === "monthly" ? p.priceAed : p.priceAed / 3), 0);
  const last = bench.reduce<Date | null>((a, b) => (!a || b.computedAt > a ? b.computedAt : a), null);
  const packagers = await Promise.all(DATA_PRODUCTS.map((p) => lastOutput(user.tenantId, "data-product-packager", p.slug)));
  return (
    <PageContainer>
      <PageHeader eyebrow="Nakhla platform" title="Business intelligence" subtitle={`The benchmark programme across advisory firms and the data products built on it. Benchmarks publish at ${MIN_FIRMS} firms and ${MIN_OBSERVATIONS} observations; below that they are held as indicative and never leave the platform.`} />
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Contributing firms" value={String(firms[0]?.n ?? 0)} note={`${MIN_FIRMS} needed to publish`} />
        <StatCard label="Benchmarks computed" value={String(bench.length)} note={last ? `Last run ${formatDate(last)}` : "Not yet run"} />
        <StatCard label="Published" value={String(bench.filter((b) => b.published).length)} note={`${bench.filter((b) => !b.published).length} indicative`} />
        <StatCard label="Data product revenue" value={formatLocal(mrr, "AED")} note="Monthly recurring" />
      </section>
      <Section title="Benchmark run" eyebrow="Agent 36 · Benchmark computer">
        {review && <AgentOutput className="mb-4" agent="Benchmark computer" output={review.output} model={review.model} costUsd={review.costUsd} at={review.at} />}
        <BiJob job="benchmarks" label="Run benchmarks now" agent="Benchmark computer" />
      </Section>
      <Section title="All benchmarks" description="Platform view, including indicative figures with their cohort sizes.">
        <SimpleTable
          rows={bench.filter((b) => b.segment === "All")}
          minWidth={900}
          columns={[
            { key: "m", header: "Metric", cell: (b) => <span className="text-ink-900">{b.metric}</span> },
            { key: "r", header: "Market", cell: (b) => (b.region === "All" ? "All" : b.region.replace("_", " ")) },
            { key: "v", header: "Median", numeric: true, cell: (b) => `${b.value} ${b.unit}` },
            { key: "f", header: "Firms", numeric: true, cell: (b) => b.firms },
            { key: "n", header: "Observations", numeric: true, cell: (b) => b.sampleSize },
            { key: "p", header: "Status", cell: (b) => <Flag tone={b.published ? "complete" : "neutral"}>{b.published ? "Published" : "Indicative"}</Flag> },
          ]}
        />
      </Section>
      <Section title="Data products" eyebrow="Agent 39 · Data product packager">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {products.map((p, i) => {
            const pk = packagers[DATA_PRODUCTS.findIndex((d) => d.slug === p.slug)] ?? packagers[i];
            return (
              <article key={p.id} className="rounded-md border border-ink-200 bg-surface p-5 shadow-card">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-display text-[19px] text-navy-900">{p.name}</h3>
                  <span className="num text-small text-ink-700">
                    {formatLocal(p.priceAed, "AED", { compact: false })} / {p.billing === "monthly" ? "month" : "quarter"}
                  </span>
                </div>
                <div className="mt-1 text-small text-ink-500">{subs.find((x) => x.productId === p.id)?.n ?? 0} subscribers</div>
                {pk && (
                  <div className="mt-3">
                    <AgentOutput agent="Latest issue" output={pk.output} at={pk.at}>
                      <StructuredDetail output={pk.output as unknown as Record<string, unknown>} />
                    </AgentOutput>
                  </div>
                )}
                <div className="mt-3">
                  <BiJob job="package" label="Package this period's issue" agent="Data product packager" body={{ slug: p.slug }} />
                </div>
              </article>
            );
          })}
        </div>
      </Section>
    </PageContainer>
  );
}
