import type { Metadata } from "next";
import { SitePage } from "@/components/site/page-view";
import { getDb } from "@/db";
import { siteBase, siteBySlug } from "@/lib/website/service";

type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const cfg = await siteBySlug(await getDb(), (await params).slug);
  if (!cfg) return {};
  const base = siteBase(cfg);
  return { title: { absolute: cfg.seo.title }, description: cfg.seo.description, keywords: cfg.seo.keywords, alternates: { canonical: `${base}/` }, robots: cfg.seo.index ? undefined : { index: false, follow: false }, openGraph: { title: cfg.seo.title, description: cfg.seo.description, url: `${base}/`, type: "website", images: cfg.seo.ogImage ? [cfg.seo.ogImage] : undefined } };
}

export default async function SiteHome({ params, searchParams }: P) {
  return <SitePage slug={(await params).slug} page="home" preview={(await searchParams).preview} />;
}
