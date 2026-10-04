import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { eq } from "drizzle-orm";
import { resolveSite } from "@/lib/website/request";
import { themeStyle } from "@/lib/website/themes";

export const dynamic = "force-dynamic";

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const site = await resolveSite((await params).slug);
  if (!site) notFound();
  const db = await getDb();
  const [tenant] = await db.select().from(s.tenants).where(eq(s.tenants.id, site.cfg.tenantId));
  const pages = await db.select({ slug: s.websitePages.slug, title: s.websitePages.title, published: s.websitePages.published, position: s.websitePages.position }).from(s.websitePages).where(eq(s.websitePages.tenantId, site.cfg.tenantId));
  const nav = pages.filter((p) => p.slug !== "home" && p.published).sort((a, b) => a.position - b.position);
  const style = themeStyle(site.cfg.theme, { primary: tenant?.configJson.primary_color ?? "#0A1F44", accent: tenant?.configJson.accent_color ?? "#C9A961" });
  return (
    <div className="flex min-h-dvh flex-col" style={{ ...style, background: "var(--site-bg)", color: "var(--site-ink)" } as React.CSSProperties}>
      <header className="border-b" style={{ borderColor: "var(--site-line)", background: "var(--site-surface)" }}>
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-6 px-4 md:px-8">
          <Link href={site.base || "/"} className="text-[17px] tracking-[0.02em]" style={{ fontFamily: "var(--site-display)" }}>
            {tenant?.configJson.brand_name ?? tenant?.name}
          </Link>
          <nav className="flex items-center gap-5 overflow-x-auto text-[14px]" aria-label="Site">
            {nav.map((p) => (
              <Link key={p.slug} href={`${site.base}/${p.slug}`} className="whitespace-nowrap transition-opacity duration-150 hover:opacity-70">
                {p.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t" style={{ borderColor: "var(--site-line)" }}>
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-2 px-4 py-8 text-[13px] md:flex-row md:justify-between md:px-8" style={{ color: "var(--site-muted)" }}>
          <span>
            © {new Date().getFullYear()} {tenant?.name}. {site.cfg.contact.address ?? ""}
          </span>
          <span>Listings are shown as advertised and are subject to contract.</span>
        </div>
      </footer>
    </div>
  );
}
