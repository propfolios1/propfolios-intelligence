import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteContactForm } from "@/components/site/contact-form";
import { getDb } from "@/db";
import { formatLocal } from "@/lib/format";
import { listingByReference, listingJsonLd, siteBase, siteBySlug } from "@/lib/website/service";
import { resolveSite } from "@/lib/website/request";

type P = { params: Promise<{ slug: string; ref: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug, ref } = await params;
  const db = await getDb();
  const cfg = await siteBySlug(db, slug);
  if (!cfg) return {};
  const r = await listingByReference(db, cfg.tenantId, ref);
  if (!r) return { title: "Listing no longer available" };
  const url = `${siteBase(cfg)}/listings/${ref.toLowerCase()}`;
  return { title: { absolute: `${r.l.title} | ${formatLocal(r.l.price, r.l.currency, { compact: false })}` }, description: r.l.description.slice(0, 160), alternates: { canonical: url }, openGraph: { title: r.l.title, description: r.l.description.slice(0, 200), url, type: "website", images: r.l.photos.slice(0, 1).map((p) => p.url) } };
}

export default async function SiteListing({ params }: P) {
  const { slug, ref } = await params;
  const site = await resolveSite(slug);
  if (!site || !site.cfg.publishedAt) notFound();
  const r = await listingByReference(site.db, site.cfg.tenantId, ref);
  if (!r) notFound();
  const l = r.l;
  const facts: [string, string][] = [
    ["Price", `${formatLocal(l.price, l.currency, { compact: false })}${l.purpose === "rent" ? (l.rentPeriod === "annual" ? " a year" : " a month") : ""}`],
    ["Bedrooms", l.bedrooms === null ? "" : l.bedrooms === 0 ? "Studio" : String(l.bedrooms)],
    ["Bathrooms", l.bathrooms ? String(l.bathrooms) : ""],
    ["Size", `${Math.round(l.area).toLocaleString("en-US")} ${l.areaUnit === "sqm" ? "sq m" : "sq ft"}`],
    ["Type", l.propertyType],
    ["Location", `${l.community}, ${l.city}`],
    ["Permit", l.permitNumber ?? ""],
    ["Reference", l.reference],
  ].filter(([, v]) => v) as [string, string][];
  return (
    <section className="mx-auto w-full max-w-[1200px] px-4 py-12 md:px-8 md:py-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(listingJsonLd(site.cfg, l)) }} />
      <Link href={`${site.base}/listings`} className="text-[14px]" style={{ color: "var(--site-muted)" }}>
        All listings
      </Link>
      <h1 className="mt-4 max-w-[30ch] text-[32px] leading-tight md:text-[44px]" style={{ fontFamily: "var(--site-display)" }}>
        {l.title}
      </h1>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div>
          <div className="aspect-[16/9] w-full" style={{ background: "linear-gradient(135deg, var(--site-primary), color-mix(in oklab, var(--site-primary) 55%, var(--site-accent)))", borderRadius: "var(--site-radius)" }} />
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {facts.map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] tracking-[0.08em] uppercase" style={{ color: "var(--site-muted)" }}>
                  {k}
                </dt>
                <dd className="mt-1 font-mono text-[15px] tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-10 max-w-[68ch] space-y-4 text-[17px] leading-[1.7]">
            {l.description.split(/\n+/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {l.features.length > 0 && (
            <ul className="mt-8 flex flex-wrap gap-2">
              {l.features.map((f) => (
                <li key={f} className="border px-3 py-1 text-[13px]" style={{ borderColor: "var(--site-line)", borderRadius: "999px" }}>
                  {f}
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside>
          <p className="mb-4 text-[15px]" style={{ color: "var(--site-muted)" }}>
            Listed by {r.agent ?? "our team"}
          </p>
          <SiteContactForm slug={site.cfg.slug} listingId={l.id} listingTitle={l.title} />
        </aside>
      </div>
    </section>
  );
}
