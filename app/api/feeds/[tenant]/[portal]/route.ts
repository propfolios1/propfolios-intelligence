import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { verifyFeedToken } from "@/lib/brokerage/feed-token";
import { portalFeed } from "@/lib/brokerage/listings";

export const dynamic = "force-dynamic";

/** Listing syndication feed for one portal, pulled by the portal with the signed token from the listing page. */
export async function GET(req: Request, { params }: { params: Promise<{ tenant: string; portal: string }> }) {
  const { tenant: slug, portal } = await params;
  const db = await getDb();
  const [t] = await db.select({ id: s.tenants.id, name: s.tenants.name, status: s.tenants.status }).from(s.tenants).where(eq(s.tenants.slug, slug));
  const token = new URL(req.url).searchParams.get("token");
  if (!t || t.status === "suspended" || t.status === "cancelled" || !verifyFeedToken(t.id, portal, token)) return new Response("Not found", { status: 404 });
  try {
    const body = await portalFeed(db, t, portal);
    return new Response(body, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "private, max-age=300" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
