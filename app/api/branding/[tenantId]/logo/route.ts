import { NextResponse } from "next/server";
import { getTenantById } from "@/lib/tenant";
import { readObject } from "@/lib/storage";

/**
 * Serves a tenant's logo from the private branding bucket. Public, because
 * the brand appears on sign-in pages and custom domains; it returns only the
 * logo object recorded in the tenant's configuration.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return new NextResponse(null, { status: 404 });
  const tenant = await getTenantById(tenantId);
  const path = tenant?.configJson.logo_path;
  if (!path || !path.startsWith(`branding/${tenantId}/`)) return new NextResponse(null, { status: 404 });
  const file = await readObject(path);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(file, { headers: { "content-type": file.type || "image/png", "cache-control": "public, max-age=3600, stale-while-revalidate=86400" } });
}
