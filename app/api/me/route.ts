import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";

export const GET = handle(async () => {
  const user = await requireApiUser();
  const db = await getDb();
  const [row] = await db.select().from(s.users).where(eq(s.users.id, user.id));
  return NextResponse.json({ ...user, preferences: row?.preferences ?? null });
});

const patch = z.object({
  title: z.string().trim().max(80).optional(),
  preferences: z.object({ digest: z.enum(["daily", "weekly", "off"]), alerts: z.boolean(), currency: z.enum(["AED", "USD", "INR"]) }).optional(),
});

export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser();
  const input = await parseBody(req, patch);
  const db = await getDb();
  const [row] = await db.update(s.users).set(input).where(eq(s.users.id, user.id)).returning();
  await audit(user, "updated profile settings");
  return NextResponse.json(row);
});
