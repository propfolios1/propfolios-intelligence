import { PageHeader } from "@/components/composites/page-header";
import { WebsiteTabs } from "@/components/site/admin-nav";
import { SeoSettings } from "@/components/site/settings";
import { PageContainer } from "@/components/shell/page-container";
import { websiteAdmin } from "@/lib/website/admin";

export const metadata = { title: "Website search settings" };
export const dynamic = "force-dynamic";

export default async function SeoPage() {
  const w = await websiteAdmin();
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Website" subtitle="How the site appears in search results and when its links are shared." />
      <WebsiteTabs active="/admin/website/seo" url={w.publicUrl} />
      <div className="mt-8">
        <SeoSettings seo={w.cfg.seo} contact={w.cfg.contact} base={w.publicUrl} />
      </div>
    </PageContainer>
  );
}
