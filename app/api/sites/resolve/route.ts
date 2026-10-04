import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { siteBySlug } from "@/lib/website/service";

/** Middleware lookup: which published site, if any, a verified custom domain serves. */
export async function GET(req: Request) {
  const host = new URL(req.url).searchParams.get("host")?.toLowerCase() ?? "";
  if (!host) return NextResponse.json({ slug: null });
  const cfg = await siteBySlug(await getDb(), `@${host}`);
  return NextResponse.json({ slug: cfg?.publishedAt ? cfg.slug : null }, { headers: { "cache-control": "public, max-age=300" } });
}
