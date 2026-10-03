import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { initialTimeline } from "@/lib/ai/orchestrator";
import { audit } from "@/lib/api";
import { HttpError, type CurrentUser } from "@/lib/auth";
import { nextMandateReference } from "@/lib/queries";

export const createMandateSchema = z.object({
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

/** Creates a mandate at INTAKE after checking client and property belong to the caller's tenant. */
export async function createMandate(db: DB, user: CurrentUser & { apiKey?: boolean }, input: z.infer<typeof createMandateSchema>) {
  const [client] = await db.select({ id: s.clients.id }).from(s.clients).where(and(eq(s.clients.id, input.clientId), eq(s.clients.tenantId, user.tenantId)));
  if (!client) throw new HttpError(422, "Client not found.");
  const [property] = await db.select({ id: s.properties.id }).from(s.properties).where(and(eq(s.properties.id, input.propertyId), eq(s.properties.tenantId, user.tenantId)));
  if (!property) throw new HttpError(422, "Property not found.");
  const reference = await nextMandateReference(db, user.tenantId);
  const [m] = await db
    .insert(s.mandates)
    .values({ ...input, tenantId: user.tenantId, reference, analystId: user.apiKey ? null : user.demo || user.role !== "client" ? user.id : null, status: "INTAKE", timeline: initialTimeline() })
    .returning();
  await audit(user, `created mandate ${reference}`, { entityType: "mandate", entityId: m!.id, mandateId: m!.id });
  const { publish } = await import("@/lib/ai/orchestration/event-bus");
  await publish(db, { type: "mandate.created", tenantId: user.tenantId, entityType: "mandate", entityId: m!.id, mandateId: m!.id, clientId: m!.clientId, actor: user.name, payload: { label: `${reference}: ${m!.title}`, href: `/analyst/mandates/${m!.id}` } });
  return m!;
}
