import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader />
      <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-8 pb-24 sm:px-6 md:px-12 xl:px-20">{children}</div>
      <SiteFooter />
    </div>
  );
}
