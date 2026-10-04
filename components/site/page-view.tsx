import { notFound } from "next/navigation";
import type { BlockType } from "@/db/schema-production";
import { pageData, organisationJsonLd } from "@/lib/website/service";
import { previewAllowed, resolveSite } from "@/lib/website/request";
import { SiteBlock } from "./blocks";

export async function SitePage({ slug, page, preview }: { slug: string; page: string; preview?: string }) {
  const site = await resolveSite(slug);
  if (!site) notFound();
  const draft = previewAllowed(site.cfg.tenantId, preview);
  if (!site.cfg.publishedAt && !draft) notFound();
  const data = await pageData(site.db, site.cfg, page, draft);
  if (!data) notFound();
  const ctx = { tenantId: site.cfg.tenantId, base: site.base, slug: site.cfg.slug, contact: site.cfg.contact };
  return (
    <>
      {page === "home" && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organisationJsonLd(site.cfg, data.tenant.name)) }} />}
      {draft && <div className="px-4 py-2 text-center text-[12px]" style={{ background: "var(--site-accent)", color: "#0A0A0A" }}>Preview of unpublished changes</div>}
      {data.blocks.map((b, i) => (
        <SiteBlock key={i} type={b.type as BlockType} content={b.content} ctx={ctx} />
      ))}
    </>
  );
}
