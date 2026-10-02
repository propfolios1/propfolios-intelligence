import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { crossBorder } from "@/lib/ai/agents";
import { handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { tenantFeatures } from "@/lib/features";
import { getMarket } from "@/lib/queries";
import { enforceRateLimit } from "@/lib/rate-limit";
import { scope } from "@/lib/tenant-db";

export const maxDuration = 60;

/** Indicative assumptions where the tenant's catalogue has no series of its own. */
const INDIA_GROWTH_PCT = 7.0;
const INR_DEPRECIATION_PCT = 2.5;

/**
 * UAE versus India arbitrage for a representative NRI allocation, built from
 * the tenant's market series and catalogue, run through the cross-border agent.
 */
export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  if (!(await tenantFeatures(user.tenantId)).crossBorder) throw new HttpError(403, "The cross-border agent is not enabled for this workspace.");
  await enforceRateLimit(user, "agents");
  const db = await getDb();
  const market = await getMarket(db, user.tenantId);
  const dubai = market.find((m) => m.region === "Dubai") ?? market[0];
  if (!dubai) throw new HttpError(422, "No UAE market series in this workspace.");
  const uaeYield = market.reduce((a, m) => a + m.latest.rentalYield * m.latest.transactions, 0) / market.reduce((a, m) => a + m.latest.transactions, 0);
  const india = await db.select().from(s.properties).where(scope(s.properties, user.tenantId, eq(s.properties.market, "India"), eq(s.properties.status, "ready"))).orderBy(desc(s.properties.grossYield));
  if (!india.length) throw new HttpError(422, "No completed India projects in this workspace's catalogue.");
  const indiaYield = india.reduce((a, p) => a + p.grossYield, 0) / india.length;
  const [nri] = await db.select().from(s.clients).where(and(eq(s.clients.tenantId, user.tenantId), eq(s.clients.nationality, "Indian"))).limit(1);
  const rep = india[0]!;
  const run = await crossBorder(
    {
      client: nri ? { name: nri.name, nationality: nri.nationality, residency: nri.residency } : { name: "Representative NRI client", nationality: "Indian", residency: "UAE resident (NRI)" },
      property: { name: rep.name, market: "India", region: rep.region, priceLocal: rep.priceMin, currency: rep.currency },
      structure: "Direct individual ownership funded from an NRE account",
      markets: { uaeGrossYieldPct: +uaeYield.toFixed(2), uaePriceGrowthPct: +dubai.priceChangePct.toFixed(1), indiaGrossYieldPct: +indiaYield.toFixed(2), indiaPriceGrowthPct: INDIA_GROWTH_PCT, inrDepreciationPct: INR_DEPRECIATION_PCT },
    },
    { tenantId: user.tenantId, actor: user.name },
  );
  return NextResponse.json({ ...run.output, replay: run.replay, inputs: { uaeYield, indiaYield, uaeGrowth: dubai.priceChangePct, indiaGrowth: INDIA_GROWTH_PCT, inrDepreciation: INR_DEPRECIATION_PCT } });
});
