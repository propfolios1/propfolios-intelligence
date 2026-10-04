import "server-only";
import type { DB } from "@/db";
import { MARKETS } from "@/lib/markets";
import { portalOverview } from "./service";
import { PORTAL_SPECS } from "./specs";

/** Connection cards for the portals page. */
export async function portalCards(db: DB, tenantId: string) {
  const o = await portalOverview(db, tenantId);
  const cards = Object.values(PORTAL_SPECS).map((spec) => {
    const c = o.conns.find((x) => x.portal === spec.key && x.status !== "disabled");
    const n = (st: string) => o.counts.filter((x) => x.portal === spec.key && x.status === st).reduce((a, x) => a + x.n, 0);
    return {
      key: spec.key,
      name: spec.name,
      market: MARKETS[spec.market].name,
      flag: MARKETS[spec.market].flag,
      transport: spec.transport,
      credentials: spec.credentials,
      defaultBaseUrl: spec.defaultBaseUrl,
      access: spec.access,
      connected: Boolean(c),
      sandbox: c?.config.sandboxMode === "true",
      status: c?.status ?? null,
      lastSyncAt: c?.lastSyncAt?.toISOString() ?? null,
      lastError: c?.lastError ?? null,
      live: n("live"),
      queued: n("queued") + n("publishing"),
      rejected: n("rejected") + n("error"),
    };
  });
  return { cards, jobs: o.jobs };
}
