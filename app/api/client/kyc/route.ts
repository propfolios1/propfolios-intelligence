import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { complianceSettings, startKyc, submitKyc, updateKyc } from "@/lib/compliance/service";
import { scope } from "@/lib/tenant-db";
import { kycPatch } from "@/lib/compliance/schemas";

/** The client's own due diligence: they upload documents and make declarations; the firm verifies and decides. */
async function own() {
  const user = await requireApiUser(["client"]);
  if (!user.clientId) throw new HttpError(403, "No client record is linked to this login.");
  const db = await getDb();
  let [k] = await db.select().from(s.kycVerifications).where(scope(s.kycVerifications, user.tenantId, eq(s.kycVerifications.clientId, user.clientId))).orderBy(desc(s.kycVerifications.createdAt)).limit(1);
  if (!k || k.status === "expired") {
    const [c] = await db.select().from(s.clients).where(eq(s.clients.id, user.clientId));
    const settings = await complianceSettings(db, user.tenantId);
    k = await startKyc(db, user.tenantId, { subjectType: "client", clientId: user.clientId, name: c!.name, entityType: /family office|company/i.test(c!.type) ? "company" : "person", jurisdiction: /india|nri/i.test(c!.residency) ? "IN" : settings.jurisdictions[0]! });
  }
  return { user, db, k };
}

export const GET = handle(async () => {
  const { k } = await own();
  return NextResponse.json({ verification: k });
});

export const PATCH = handle(async (req: Request) => {
  const { user, db, k } = await own();
  const b = await parseBody(req, kycPatch.omit({ level: true }));
  const u = await updateKyc(db, user.tenantId, k.id, { ...b, documents: b.documents?.map((d) => ({ type: d.type, documentId: d.documentId, expiresAt: d.expiresAt })) }, { clientId: user.clientId });
  await audit(user, "updated their due diligence declarations", { entityType: "kyc_verification", entityId: k.id });
  return NextResponse.json({ verification: u });
});

export const POST = handle(async () => {
  const { user, db, k } = await own();
  const u = await submitKyc(db, user.tenantId, k.id, { clientId: user.clientId });
  await audit(user, "submitted their due diligence for review", { entityType: "kyc_verification", entityId: k.id });
  return NextResponse.json({ verification: u });
});
