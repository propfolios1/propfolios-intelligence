import "server-only";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { previewToken } from "./request";
import { getEditorData, siteBase } from "./service";

export async function websiteAdmin() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const data = await getEditorData(db, user.tenantId);
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  return { user, db, ...data, publicUrl: siteBase(data.cfg), previewBase: `${origin}/sites/${data.cfg.slug}`, token: previewToken(user.tenantId) };
}
