import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { connectDeveloper, syncConnection } from "@/lib/developers/sync";

const field = z.string().trim().max(80).optional();
const body = z.object({
  developerKey: z.string().max(40),
  mode: z.enum(["feed_url", "json_api", "upload", "sandbox"]),
  url: z.string().trim().url().nullable().optional(),
  format: z.enum(["csv", "json", "xml"]).nullable().optional(),
  authHeader: z.string().trim().max(2000).nullable().optional(),
  mapping: z.object({ unitRef: field, project: field, building: field, unitType: field, bedrooms: field, areaSqft: field, price: field, currency: field, status: field, floor: field, view: field, handover: field, paymentPlan: field }).optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  requirePermission(user, "firm:settings");
  const b = await parseBody(req, body);
  const db = await getDb();
  const c = await connectDeveloper(db, user.tenantId, { ...b, mapping: Object.fromEntries(Object.entries(b.mapping ?? {}).filter(([, v]) => v)) });
  await audit(user, `connected ${c.name} inventory (${b.mode.replace("_", " ")})`, { entityType: "developer_connection", entityId: c.id });
  const run = b.mode === "upload" ? null : await syncConnection(db, user.tenantId, c.id);
  return NextResponse.json({ connection: { id: c.id, developerKey: c.developerKey }, run }, { status: 201 });
});
