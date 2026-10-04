import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { screen } from "@/lib/compliance/service";
import { scope } from "@/lib/tenant-db";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  return NextResponse.json({ screenings: await (await getDb()).select().from(s.amlScreenings).where(scope(s.amlScreenings, user.tenantId)).orderBy(desc(s.amlScreenings.createdAt)).limit(200) });
});

const body = z.object({
  subjectType: z.enum(["client", "lead", "counterparty", "beneficial_owner"]),
  subjectId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(2).max(160),
  entityType: z.enum(["person", "company"]).default("person"),
  birthDate: z.string().regex(/^\d{4}(-\d{2}-\d{2})?$/).nullable().optional(),
  nationality: z.string().trim().max(60).nullable().optional(),
  jurisdiction: z.enum(["AE", "IN", "GB", "SG"]),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, body);
  const row = await screen(await getDb(), user.tenantId, b);
  await audit(user, `screened ${b.name}: ${row.status.replace("_", " ")}`, { entityType: "aml_screening", entityId: row.id, after: { provider: row.provider, status: row.status, hits: row.hits.length } });
  return NextResponse.json({ screening: row }, { status: 201 });
});
