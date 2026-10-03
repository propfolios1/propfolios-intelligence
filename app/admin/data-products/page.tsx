import { eq } from "drizzle-orm";
import { SubscribeButton } from "@/components/bi/bi-actions";
import { PageHeader } from "@/components/composites/page-header";
import { Flag } from "@/components/os/badges";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ensureDataProducts } from "@/lib/bi/service";
import { formatLocal } from "@/lib/format";

export const metadata = { title: "Data products" };
export const dynamic = "force-dynamic";

export default async function DataProducts() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const products = await ensureDataProducts(db);
  const subs = await db.select().from(s.dataSubscriptions).where(eq(s.dataSubscriptions.tenantId, user.tenantId));
  const active = (id: string) => subs.some((x) => x.dataProductId === id && x.status === "active");
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration · Intelligence" title="Data products" subtitle="Federated data packaged from the Nakhla network: market data, developer risk, registered comparables and operating benchmarks. Anonymised, thresholded and refreshed on schedule." />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {products.map((p) => (
          <article key={p.id} className="flex flex-col rounded-md border border-hairline bg-surface p-6 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-section text-navy-900">{p.name}</h2>
                <div className="mt-1 text-small text-ink-500">{p.format}</div>
              </div>
              {active(p.id) && <Flag tone="complete">Subscribed</Flag>}
            </div>
            <p className="mt-3 text-small text-ink-700">{p.description}</p>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-small text-ink-700">
              {p.contents.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="mt-auto flex items-end justify-between gap-3 pt-6">
              <div>
                <span className="num text-section text-navy-900">{formatLocal(p.priceAed, "AED", { compact: false })}</span>
                <span className="text-small text-ink-500"> per {p.billing === "monthly" ? "month" : "quarter"}</span>
              </div>
              <SubscribeButton id={p.id} active={active(p.id)} />
            </div>
          </article>
        ))}
      </div>
    </PageContainer>
  );
}
