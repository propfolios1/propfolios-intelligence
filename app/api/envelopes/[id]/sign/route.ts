import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";

/** The client signs an envelope in the portal: typed name, timestamp and source address are recorded. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser(["client"]);
  const { id } = await params;
  const { signerName } = await parseBody(req, z.object({ signerName: z.string().trim().min(3).max(120), agree: z.literal(true) }));
  const db = await getDb();
  const [env] = await db.select().from(s.signatureEnvelopes).where(and(eq(s.signatureEnvelopes.id, id), eq(s.signatureEnvelopes.tenantId, user.tenantId))).limit(1);
  if (!env || env.clientId !== user.clientId) throw new HttpError(404, "Envelope not found.");
  if (env.status !== "sent") throw new HttpError(409, env.status === "signed" ? "This envelope is already signed." : "This envelope was withdrawn.");
  const from = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const [row] = await db.update(s.signatureEnvelopes).set({ status: "signed", signerName, signedAt: new Date(), signedFrom: from }).where(eq(s.signatureEnvelopes.id, id)).returning();
  await audit(user, "signed instruction envelope", { entityType: "envelope", entityId: id, mandateId: env.mandateId ?? undefined, detail: { signerName } });
  return NextResponse.json(row);
});
