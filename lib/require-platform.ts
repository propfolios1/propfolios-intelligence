import "server-only";
import { notFound } from "next/navigation";
import { requireRole } from "./auth";

/** Server components in /platform: platform administrators only (never while viewing a tenant). */
export async function requirePlatformAdmin() {
  const user = await requireRole(["platform_admin", "tenant_admin"]);
  if (!user.platformAdmin || user.impersonating) notFound();
  return user;
}
