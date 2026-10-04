import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { startKyc } from "@/lib/compliance/service";
import { scope } from "@/lib/tenant-db";

const body = z.object({
  clientId: z.string().uuid().nullable().optional(),
  subjectType: z.enum(["client", "lead", "counterparty", "beneficial_owner"]).default("client"),
  name: z.string().trim().min(2).max(160).optional(),
  entityType: z.enum(["person", "company"]).default("person"),
  jurisdiction: z.enum(["AE", "IN", "GB", "SG"]),
  level: z.enum(["simplified", "standard", "enhanced"]).default("standard"),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, body);
  const db = await getDb();
  let name = b.name;
  if (b.clientId) {
    const [c] = await db.select({ name: s.clients.name }).from(s.clients).where(scope(s.clients, user.tenantId, eq(s.clients.id, b.clientId)));
    if (!c) throw new HttpError(404, "Client not found.");
    name = c.name;
  }
  if (!name) throw new HttpError(422, "Name the subject or choose a client.");
  const k = await startKyc(db, user.tenantId, { subjectType: b.clientId ? "client" : b.subjectType, clientId: b.clientId ?? null, name, entityType: b.entityType, jurisdiction: b.jurisdiction, level: b.level });
  await audit(user, `started ${b.level} due diligence for ${name}`, { entityType: "kyc_verification", entityId: k.id });
  return NextResponse.json({ verification: k }, { status: 201 });
});
