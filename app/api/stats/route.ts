import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { securityStats } from "@/lib/security/stats";

export const dynamic = "force-dynamic";

/** Public: row-level security coverage of the deployed database. Table names are not disclosed. */
export async function GET() {
  try {
    const s = await securityStats(await getDb());
    return NextResponse.json({ rlsPolicies: s.rlsPolicies, rlsTables: s.rlsTables, publicTables: s.publicTables, storagePolicies: s.storagePolicies, generatedAt: s.generatedAt }, { headers: { "cache-control": "public, max-age=60, s-maxage=300" } });
  } catch {
    return NextResponse.json({ error: "Statistics are unavailable." }, { status: 503 });
  }
}
