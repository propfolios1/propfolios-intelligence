import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { initialTimeline, PIPELINE } from "@/lib/ai/orchestrator";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { listMandates, nextMandateReference } from "@/lib/queries";

const STAGES = PIPELINE.map((p) => p.stage) as [string, ...string[]];

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const url = new URL(req.url);
  const q = z
    .object({ status: z.enum(STAGES).optional(), clientId: z.uuid().optional(), q: z.string().max(100).optional() })
    .parse(Object.fromEntries(url.searchParams));
  const db = await getDb();
  return NextResponse.json(await listMandates(db, user, q as Parameters<typeof listMandates>[2]));
});

const createMandateSchema = z.object({
  title: z.string().trim().min(3).max(120),
  clientId: z.uuid(),
  propertyId: z.uuid(),
  objective: z.string().trim().min(3).max(200),
  brief: z.string().trim().min(20).max(4000),
  ticketSizeAed: z.number().positive().max(1_000_000_000),
  horizonYears: z.number().int().min(1).max(15),
  priority: z.enum(["standard", "priority"]).default("standard"),
  deadline: z.iso.date().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["admin", "analyst"]);
  const input = await parseBody(req, createMandateSchema);
  const db = await getDb();
  const [client] = await db.select({ id: s.clients.id }).from(s.clients).where(and(eq(s.clients.id, input.clientId), eq(s.clients.tenantId, user.tenantId)));
  if (!client) throw new HttpError(422, "Client not found.");
  const [property] = await db.select({ id: s.properties.id }).from(s.properties).where(eq(s.properties.id, input.propertyId));
  if (!property) throw new HttpError(422, "Property not found.");
  const reference = await nextMandateReference(db, user.tenantId);
  const [m] = await db
    .insert(s.mandates)
    .values({ ...input, tenantId: user.tenantId, reference, analystId: user.demo || user.role !== "client" ? user.id : null, status: "INTAKE", timeline: initialTimeline() })
    .returning();
  await audit(user, `created mandate ${reference}`, { entityType: "mandate", entityId: m!.id, mandateId: m!.id });
  return NextResponse.json(m, { status: 201 });
});
