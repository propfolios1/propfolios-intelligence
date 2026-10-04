import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { listListings } from "@/lib/brokerage/listings";
import { MARKET_CODES, marketOf } from "@/lib/markets";
import { scope } from "@/lib/tenant-db";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const rows = await listListings(await getDb(), user.tenantId);
  return NextResponse.json({ listings: rows.map((r) => ({ ...r.listing, agent: r.agent, portals: r.portals, enquiries: r.enquiries })) });
});

const body = z.object({
  title: z.string().trim().min(5).max(140),
  market: z.enum(MARKET_CODES),
  city: z.string().trim().min(2).max(80),
  community: z.string().trim().min(2).max(120),
  propertyType: z.string().trim().min(2).max(60),
  purpose: z.enum(["sale", "rent"]),
  price: z.number().positive(),
  bedrooms: z.number().int().min(0).max(20).nullable().optional(),
  bathrooms: z.number().int().min(0).max(20).nullable().optional(),
  area: z.number().positive(),
  permitNumber: z.string().trim().max(60).nullable().optional(),
  features: z.array(z.string().trim().min(2).max(80)).max(20).default([]),
  ownerName: z.string().trim().max(160).nullable().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "listings:manage");
  const b = await parseBody(req, body);
  const m = marketOf(b.market);
  const db = await getDb();
  const n = (await db.select({ id: s.listings.id }).from(s.listings).where(scope(s.listings, user.tenantId))).length;
  const [l] = await db
    .insert(s.listings)
    .values({ tenantId: user.tenantId, reference: `LS-${String(n + 1).padStart(4, "0")}`, title: b.title, market: m.code, city: b.city, community: b.community, propertyType: b.propertyType, purpose: b.purpose, price: b.price, currency: m.currency, rentPeriod: b.purpose === "rent" ? (m.code === "IN" ? "monthly" : "annual") : null, bedrooms: b.bedrooms ?? null, bathrooms: b.bathrooms ?? null, area: b.area, areaUnit: m.areaUnit, permitNumber: b.permitNumber || null, features: b.features, agentUserId: user.id, ownerName: b.ownerName ?? null })
    .returning();
  await audit(user, "created listing", { entityType: "listing", entityId: l!.id, after: l });
  return NextResponse.json({ id: l!.id, reference: l!.reference }, { status: 201 });
});
