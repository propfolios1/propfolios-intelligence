import { PageHeader } from "@/components/composites/page-header";
import { WebsiteTabs } from "@/components/site/admin-nav";
import { ThemePicker } from "@/components/site/settings";
import { PageContainer } from "@/components/shell/page-container";
import { websiteAdmin } from "@/lib/website/admin";
import { THEMES } from "@/lib/website/themes";

export const metadata = { title: "Website theme" };
export const dynamic = "force-dynamic";

export default async function ThemePage() {
  const w = await websiteAdmin();
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Website" subtitle="Five themes share every block. The firm's brand colours fill each theme's accents, set in Branding." />
      <WebsiteTabs active="/admin/website/theme" url={w.publicUrl} />
      <div className="mt-8">
        <ThemePicker current={w.cfg.theme} themes={Object.values(THEMES)} />
      </div>
    </PageContainer>
  );
}
