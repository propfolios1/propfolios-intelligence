import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { listClients } from "@/lib/queries";

export const GET = handle(async () => {
  const user = await requireApiUser(["admin", "analyst"]);
  return NextResponse.json(await listClients(await getDb(), user));
});

const create = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(["HNWI", "UHNWI", "Family Office"]),
  nationality: z.string().trim().min(2).max(60),
  residency: z.string().trim().min(2).max(60),
  domicile: z.string().trim().min(2).max(60),
  aumAed: z.number().positive(),
  riskProfile: z.enum(["Income", "Balanced", "Growth"]),
  policy: z.object({
    targetNetYield: z.number().min(0).max(20),
    maxOffPlanPct: z.number().min(0).max(100),
    maxSingleAssetPct: z.number().min(0).max(100),
    markets: z.array(z.enum(["UAE", "India"])).min(1),
    horizonYears: z.number().int().min(1).max(30),
    notes: z.string().max(1000).optional(),
  }),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["admin", "analyst"]);
  const input = await parseBody(req, create);
  const db = await getDb();
  const [c] = await db.insert(s.clients).values({ ...input, tenantId: user.tenantId, relationshipManagerId: user.id, kycStatus: "pending" }).returning();
  await audit(user, `onboarded client ${c!.name}`, { entityType: "client", entityId: c!.id });
  return NextResponse.json(c, { status: 201 });
});
