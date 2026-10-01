import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { marketTiming } from "@/lib/ai/agents";
import { handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { getMarket } from "@/lib/queries";

export const maxDuration = 60;

/** Twelve months of market data per emirate. ?region=Dubai&signal=1 adds the market-timing agent's view. */
export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const q = z.object({ region: z.string().max(40).optional(), signal: z.enum(["0", "1"]).optional() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  const all = await getMarket(await getDb());
  const regions = q.region ? all.filter((r) => r.region.toLowerCase() === q.region!.toLowerCase()) : all;
  if (q.region && !regions.length) throw new HttpError(404, `No market data for ${q.region}.`);
  if (q.signal === "1" && regions.length === 1) {
    const r = regions[0]!;
    const run = await marketTiming(
      { region: r.region, months: r.series.map((m) => ({ month: m.month, transactions: m.transactions, medianPriceSqft: m.medianPriceSqft, offPlanShare: m.offPlanShare, rentalYield: m.rentalYield, supplyUnits: m.supplyUnits, absorptionRate: m.absorptionRate })) },
      { tenantId: user.tenantId, actor: user.name, signal: req.signal },
    );
    return NextResponse.json({ ...r, timing: run.output, replay: run.replay });
  }
  return NextResponse.json(regions);
});
