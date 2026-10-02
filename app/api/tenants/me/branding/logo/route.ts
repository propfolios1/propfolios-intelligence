import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { putObject, removeObject } from "@/lib/storage";
import { getTenantById } from "@/lib/tenant";

const MIME = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

/** Uploads the firm's logo to the private branding bucket ({tenant_id}/logo-…). */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  await enforceRateLimit(user, "upload");
  const tenant = await getTenantById(user.tenantId);
  if (!tenant) throw new HttpError(404, "Workspace not found.");
  if (tenant.plan === "starter") throw new HttpError(402, "Custom branding is available from the Professional plan.");
  const form = await req.formData().catch(() => {
    throw new HttpError(400, "Expected a multipart form.");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "Attach an image.");
  if (file.size > 1024 * 1024) throw new HttpError(413, "Logos must be 1 MB or smaller.");
  if (!MIME.includes(file.type)) throw new HttpError(415, "Upload a PNG, JPEG, WebP or SVG image.");
  const stored = await putObject({ bucket: "branding", tenantId: user.tenantId, folder: "logo", name: file.name, body: file, contentType: file.type });
  if (stored.provider === "none") throw new HttpError(503, "File storage is not configured on this deployment. Connect Supabase to upload a logo.");
  const previous = tenant.configJson.logo_path;
  const logoUrl = stored.storagePath ? `/api/branding/${user.tenantId}/logo?v=${Date.now()}` : stored.url;
  const db = await getDb();
  await db
    .update(s.tenants)
    .set({ configJson: { ...tenant.configJson, logo_url: logoUrl, logo_path: stored.storagePath ?? null } })
    .where(eq(s.tenants.id, user.tenantId));
  if (previous && previous !== stored.storagePath) await removeObject(previous).catch(() => {});
  await audit(user, "uploaded firm logo", { entityType: "tenant", entityId: user.tenantId, detail: { provider: stored.provider } });
  return NextResponse.json({ logo_url: logoUrl }, { status: 201 });
});

export const DELETE = handle(async () => {
  const user = await requireApiUser(["tenant_admin"]);
  const tenant = await getTenantById(user.tenantId);
  if (!tenant) throw new HttpError(404, "Workspace not found.");
  if (tenant.configJson.logo_path) await removeObject(tenant.configJson.logo_path).catch(() => {});
  const db = await getDb();
  await db.update(s.tenants).set({ configJson: { ...tenant.configJson, logo_url: null, logo_path: null } }).where(eq(s.tenants.id, user.tenantId));
  await audit(user, "removed firm logo", { entityType: "tenant", entityId: user.tenantId });
  return NextResponse.json({ ok: true });
});
