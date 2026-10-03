import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { handle } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { lookupSource, SOURCE_IDS, SOURCES, type SourceId } from "@/lib/india/sources";

/** One India register lookup for a property: GET /api/india/sources/maharera?propertyId=… Staff only. */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ source: string }> }) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const { source } = await params;
  if (!SOURCE_IDS.includes(source as SourceId)) throw new HttpError(404, `Unknown source "${source}". Available: ${SOURCE_IDS.join(", ")}.`);
  const propertyId = new URL(req.url).searchParams.get("propertyId");
  if (!propertyId) {
    const d = SOURCES[source as SourceId];
    return NextResponse.json({ source: d.id, label: d.label, state: d.state, authority: d.authority, portal: d.portal, covers: d.covers, mode: "mock" });
  }
  const result = await lookupSource(await getDb(), user.tenantId, source as SourceId, propertyId);
  if (!result) throw new HttpError(404, "Property not found.");
  return NextResponse.json(result);
});
