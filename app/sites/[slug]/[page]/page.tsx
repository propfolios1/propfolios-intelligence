import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { SitePage } from "@/components/site/page-view";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { siteBase, siteBySlug } from "@/lib/website/service";

type P = { params: Promise<{ slug: string; page: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug, page } = await params;
  const db = await getDb();
  const cfg = await siteBySlug(db, slug);
  if (!cfg) return {};
  const [p] = await db.select({ title: s.websitePages.title }).from(s.websitePages).where(and(eq(s.websitePages.tenantId, cfg.tenantId), eq(s.websitePages.slug, page)));
  const base = siteBase(cfg);
  const title = p ? `${p.title} | ${cfg.seo.title.split("|")[0]!.trim()}` : cfg.seo.title;
  return { title: { absolute: title }, description: cfg.seo.description, alternates: { canonical: `${base}/${page}` }, robots: cfg.seo.index ? undefined : { index: false, follow: false }, openGraph: { title, description: cfg.seo.description, url: `${base}/${page}`, type: "website", images: cfg.seo.ogImage ? [cfg.seo.ogImage] : undefined } };
}

export default async function SiteInner({ params, searchParams }: P) {
  const { slug, page } = await params;
  return <SitePage slug={slug} page={page} preview={(await searchParams).preview} />;
}
