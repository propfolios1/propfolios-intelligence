import { PageHeader } from "@/components/composites/page-header";
import { WebsiteTabs } from "@/components/site/admin-nav";
import { DomainSettings } from "@/components/site/settings";
import { PageContainer } from "@/components/shell/page-container";
import { websiteAdmin } from "@/lib/website/admin";
import { sitesDomain } from "@/lib/website/service";

export const metadata = { title: "Website domain" };
export const dynamic = "force-dynamic";

export default async function DomainPage() {
  const w = await websiteAdmin();
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Website" subtitle="Serve the site on the firm's own domain. Verification proves control of the domain with a TXT record and checks the CNAME before traffic is accepted." />
      <WebsiteTabs active="/admin/website/domain" url={w.publicUrl} />
      <div className="mt-8">
        <DomainSettings domain={w.cfg.customDomain} token={w.cfg.domainToken} target={`sites.${sitesDomain()}`} sub={`https://${w.cfg.slug}.${sitesDomain()}`} check={w.cfg.domainCheck} verified={Boolean(w.cfg.domainVerifiedAt)} />
      </div>
    </PageContainer>
  );
}
