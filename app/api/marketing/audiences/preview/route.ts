import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { audienceCount, audienceMembers } from "@/lib/marketing/audience";
import { audienceFilterSchema } from "@/lib/marketing/schemas";

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const f = await parseBody(req, audienceFilterSchema);
  const db = await getDb();
  const [count, sample] = await Promise.all([audienceCount(db, user.tenantId, f), audienceMembers(db, user.tenantId, f, { limit: 8 })]);
  return NextResponse.json({ count, sample: sample.map((m) => ({ name: m.name, intent: m.intent, score: m.score, email: Boolean(m.email), phone: Boolean(m.phone) })) });
});
