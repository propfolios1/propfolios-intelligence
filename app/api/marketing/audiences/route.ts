import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { audienceFilterSchema } from "@/lib/marketing/schemas";
import { saveAudience } from "@/lib/marketing/service";
import { scope } from "@/lib/tenant-db";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  return NextResponse.json({ audiences: await (await getDb()).select().from(s.audiences).where(scope(s.audiences, user.tenantId)).orderBy(desc(s.audiences.updatedAt)) });
});

const body = z.object({ id: z.string().uuid().optional(), name: z.string().trim().min(3).max(80), description: z.string().trim().max(300).optional(), filter: audienceFilterSchema });

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const b = await parseBody(req, body);
  const a = await saveAudience(await getDb(), user.tenantId, { ...b, userId: user.id });
  await audit(user, `saved audience "${a.name}" (${a.lastCount} leads)`, { entityType: "audience", entityId: a.id, after: b.filter });
  return NextResponse.json({ audience: a }, { status: b.id ? 200 : 201 });
});
