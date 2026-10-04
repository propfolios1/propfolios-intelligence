import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { listingWriter } from "@/lib/ai/os-agents/brokerage";
import { marketOf, permitLabel } from "@/lib/markets";
import { enforceRateLimit } from "@/lib/rate-limit";
import { scope } from "@/lib/tenant-db";

export const maxDuration = 120;

/** Drafts the portal copy from the listing's facts. The draft is returned for review; it is applied with PATCH. */
export const POST = handle(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "listings:manage");
  await enforceRateLimit(user, "agents");
  const { id } = await params;
  const [l] = await (await getDb()).select().from(s.listings).where(scope(s.listings, user.tenantId, eq(s.listings.id, id)));
  if (!l) throw new HttpError(404, "Listing not found.");
  const m = marketOf(l.market);
  const run = await listingWriter.run(
    {
      listing: { id: l.id, title: l.title, purpose: l.purpose, propertyType: l.propertyType, city: l.city, community: l.community, price: l.price, currency: l.currency, rentPeriod: l.rentPeriod, bedrooms: l.bedrooms, bathrooms: l.bathrooms, area: l.area, areaUnit: l.areaUnit, features: l.features, permitNumber: l.permitNumber },
      market: { name: m.name, listingPermit: permitLabel(m.code, l.city), permitRequired: m.code === "AE" || m.code === "IN" },
    },
    { tenantId: user.tenantId, actor: user.name },
  );
  await audit(user, "ran listing writer", { entityType: "listing", entityId: id, detail: { costUsd: run.costUsd } });
  return NextResponse.json({ output: run.output, model: run.model, costUsd: run.costUsd });
});
