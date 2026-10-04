import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser, requirePermission } from "@/lib/auth";
import { setListingStatus } from "@/lib/brokerage/listings";
import { scope } from "@/lib/tenant-db";
import { eq } from "drizzle-orm";

const body = z.object({
  status: z.enum(["draft", "active", "under_offer", "sold", "let", "withdrawn"]).optional(),
  title: z.string().trim().min(5).max(140).optional(),
  description: z.string().trim().max(5000).optional(),
  descriptionSource: z.enum(["manual", "ai"]).optional(),
  features: z.array(z.string().trim().min(2).max(80)).max(20).optional(),
  price: z.number().positive().optional(),
  permitNumber: z.string().trim().max(60).nullable().optional(),
  virtualTourUrl: z.string().url().nullable().optional(),
});

export const PATCH = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "listings:manage");
  const { id } = await params;
  const { status, ...rest } = await parseBody(req, body);
  const db = await getDb();
  const [before] = await db.select().from(s.listings).where(scope(s.listings, user.tenantId, eq(s.listings.id, id)));
  if (!before) throw new HttpError(404, "Listing not found.");
  if (Object.keys(rest).length) await db.update(s.listings).set(rest).where(scope(s.listings, user.tenantId, eq(s.listings.id, id)));
  const after = status ? await setListingStatus(db, user.tenantId, id, status) : (await db.select().from(s.listings).where(eq(s.listings.id, id)))[0];
  await audit(user, "updated listing", { entityType: "listing", entityId: id, before, after });
  return NextResponse.json({ ok: true });
});
