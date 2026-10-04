import { getDb } from "@/db";
import { robotsTxt, siteBySlug } from "@/lib/website/service";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const cfg = await siteBySlug(await getDb(), (await params).slug);
  if (!cfg) return new Response("Not found", { status: 404 });
  return new Response(robotsTxt(cfg), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
