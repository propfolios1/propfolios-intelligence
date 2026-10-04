import { getDb } from "@/db";
import { siteBySlug, sitemapXml } from "@/lib/website/service";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const db = await getDb();
  const cfg = await siteBySlug(db, (await params).slug);
  if (!cfg || !cfg.publishedAt) return new Response("Not found", { status: 404 });
  return new Response(await sitemapXml(db, cfg), { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=900" } });
}
