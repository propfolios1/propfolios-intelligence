import { PageHeader } from "@/components/composites/page-header";
import { WebsiteTabs } from "@/components/site/admin-nav";
import { SiteEditor } from "@/components/site/editor";
import { PageContainer } from "@/components/shell/page-container";
import { websiteAdmin } from "@/lib/website/admin";

export const metadata = { title: "Website" };
export const dynamic = "force-dynamic";

export default async function WebsitePage() {
  const w = await websiteAdmin();
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Website" subtitle="The firm's public site, with every active listing on it. Edit blocks and their order, preview the draft, then publish. Listings, agents, areas and market figures update on their own as the workspace changes." />
      <WebsiteTabs active="/admin/website" url={w.publicUrl} />
      <div className="mt-8">
        <SiteEditor pages={w.pages.map((p) => ({ id: p.id, slug: p.slug, title: p.title, blocks: p.blocks, published: p.published }))} previewBase={w.previewBase} token={w.token} publishedAt={w.cfg.publishedAt?.toISOString() ?? null} />
      </div>
    </PageContainer>
  );
}
