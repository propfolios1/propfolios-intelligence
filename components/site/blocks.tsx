import Link from "next/link";
import { getDb } from "@/db";
import type { BlockType } from "@/db/schema-production";
import { formatLocal } from "@/lib/format";
import { areaStats, liveListings, siteAgents } from "@/lib/website/service";
import { SiteContactForm } from "./contact-form";

/**
 * Public site blocks. Data blocks query the firm's live records at render
 * time; static blocks render the content the firm wrote. Every style reads the
 * theme's CSS variables, so one set of blocks serves all five themes.
 */

type Ctx = { tenantId: string; base: string; slug: string; contact: { email: string | null; phone: string | null; whatsapp: string | null; address: string | null } };
type C = Record<string, unknown>;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

const H2 = ({ children }: { children: React.ReactNode }) => <h2 className="text-[30px] leading-tight tracking-[-0.01em] md:text-[40px]" style={{ fontFamily: "var(--site-display)" }}>{children}</h2>;
const Lead = ({ children }: { children: React.ReactNode }) => (children ? <p className="mt-3 max-w-[64ch] text-[17px] leading-[1.6]" style={{ color: "var(--site-muted)" }}>{children}</p> : null);
const Wrap = ({ children, id }: { children: React.ReactNode; id?: string }) => (
  <section id={id} className="mx-auto w-full max-w-[1200px] px-4 py-16 md:px-8 md:py-24">
    {children}
  </section>
);

async function Hero({ c, ctx }: { c: C; ctx: Ctx }) {
  const img = str(c.imageUrl) || null;
  return (
    <section className="relative overflow-hidden" style={{ background: img ? undefined : "var(--site-primary)", color: "var(--site-hero-ink)" }}>
      {img && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.62), rgba(0,0,0,0.18))" }} />
        </>
      )}
      <div className="relative mx-auto w-full max-w-[1200px] px-4 py-24 md:px-8 md:py-36">
        <h1 className="max-w-[18ch] text-[40px] leading-[1.04] tracking-[-0.02em] md:text-[64px]" style={{ fontFamily: "var(--site-display)" }}>
          {str(c.headline)}
        </h1>
        {str(c.subheadline) && <p className="mt-6 max-w-[56ch] text-[18px] leading-[1.6] opacity-90">{str(c.subheadline)}</p>}
        <Link href={`${ctx.base}${str(c.ctaHref, "/listings")}`} className="mt-10 inline-flex h-12 items-center px-6 text-[15px] font-medium transition-opacity duration-150 hover:opacity-90" style={{ background: "var(--site-accent)", color: "#0A0A0A", borderRadius: "var(--site-radius)" }}>
          {str(c.ctaLabel, "View listings")}
        </Link>
      </div>
    </section>
  );
}

async function Featured({ c, ctx }: { c: C; ctx: Ctx }) {
  const rows = await liveListings(await getDb(), ctx.tenantId, (c.purpose as "all" | "sale" | "rent") ?? "all", Number(c.limit ?? 6));
  return (
    <Wrap id="listings">
      <H2>{str(c.title, "Featured listings")}</H2>
      {rows.length === 0 ? (
        <p className="mt-6 text-[16px]" style={{ color: "var(--site-muted)" }}>
          New listings are being prepared. Contact an agent for homes not yet advertised.
        </p>
      ) : (
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ l }) => (
            <li key={l.id}>
              <Link href={`${ctx.base}/listings/${l.reference.toLowerCase()}`} className="group block overflow-hidden border transition-transform duration-250 hover:-translate-y-0.5" style={{ borderColor: "var(--site-line)", background: "var(--site-surface)", borderRadius: "var(--site-radius)" }}>
                <div className="flex aspect-[4/3] items-end p-4" style={{ background: "linear-gradient(135deg, var(--site-primary), color-mix(in oklab, var(--site-primary) 55%, var(--site-accent)))" }}>
                  <span className="px-2 py-1 text-[11px] font-medium tracking-[0.08em] uppercase" style={{ background: "var(--site-surface)", color: "var(--site-ink)", borderRadius: "var(--site-radius)" }}>
                    {l.status === "under_offer" ? "Under offer" : l.purpose === "rent" ? "To let" : "For sale"}
                  </span>
                </div>
                <div className="p-5">
                  <div className="font-mono text-[20px] tabular-nums">
                    {formatLocal(l.price, l.currency, { compact: false })}
                    {l.purpose === "rent" && <span className="text-[13px]" style={{ color: "var(--site-muted)" }}>{l.rentPeriod === "annual" ? " a year" : " a month"}</span>}
                  </div>
                  <h3 className="mt-2 text-[16px] leading-snug">{l.title}</h3>
                  <p className="mt-2 text-[13px]" style={{ color: "var(--site-muted)" }}>
                    {[l.bedrooms !== null ? (l.bedrooms ? `${l.bedrooms} ${l.bedrooms === 1 ? "bedroom" : "bedrooms"}` : "Studio") : null, l.bathrooms ? `${l.bathrooms} ${l.bathrooms === 1 ? "bathroom" : "bathrooms"}` : null, `${Math.round(l.area).toLocaleString("en-US")} ${l.areaUnit === "sqm" ? "sq m" : "sq ft"}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Wrap>
  );
}

async function Agents({ c, ctx }: { c: C; ctx: Ctx }) {
  const agents = await siteAgents(await getDb(), ctx.tenantId);
  if (!agents.length) return null;
  return (
    <Wrap>
      <H2>{str(c.title, "Our agents")}</H2>
      <Lead>{str(c.intro)}</Lead>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {agents.map((a) => (
          <li key={a.id} className="border p-5" style={{ borderColor: "var(--site-line)", background: "var(--site-surface)", borderRadius: "var(--site-radius)" }}>
            <div className="flex size-12 items-center justify-center text-[15px] font-medium" style={{ background: "var(--site-primary)", color: "var(--site-hero-ink)", borderRadius: "999px" }}>
              {a.name
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>
            <p className="mt-4 text-[16px]">{a.name}</p>
            <p className="text-[13px]" style={{ color: "var(--site-muted)" }}>
              {a.title ?? "Agent"}
            </p>
          </li>
        ))}
      </ul>
    </Wrap>
  );
}

function Testimonials({ c }: { c: C }) {
  const items = (c.items as { quote: string; author: string; context: string }[] | undefined) ?? [];
  if (!items.length) return null;
  return (
    <Wrap>
      <H2>{str(c.title, "What clients say")}</H2>
      <ul className="mt-10 grid gap-6 md:grid-cols-2">
        {items.map((t, i) => (
          <li key={i} className="border p-6" style={{ borderColor: "var(--site-line)", background: "var(--site-surface)", borderRadius: "var(--site-radius)" }}>
            <blockquote className="text-[18px] leading-[1.6]" style={{ fontFamily: "var(--site-display)" }}>
              {t.quote}
            </blockquote>
            <p className="mt-4 text-[13px]" style={{ color: "var(--site-muted)" }}>
              {t.author}
              {t.context ? `, ${t.context}` : ""}
            </p>
          </li>
        ))}
      </ul>
    </Wrap>
  );
}

function About({ c }: { c: C }) {
  return (
    <Wrap>
      <H2>{str(c.title, "About the firm")}</H2>
      <div className="mt-6 max-w-[68ch] space-y-4 text-[17px] leading-[1.7]">
        {str(c.body)
          .split(/\n{2,}/)
          .filter(Boolean)
          .map((p, i) => (
            <p key={i}>{p}</p>
          ))}
      </div>
    </Wrap>
  );
}

async function Areas({ c, ctx, stats }: { c: C; ctx: Ctx; stats?: boolean }) {
  const areas = await areaStats(await getDb(), ctx.tenantId);
  if (!areas.length) return null;
  return (
    <Wrap>
      <H2>{str(c.title, stats ? "The market this quarter" : "Areas we cover")}</H2>
      <Lead>{str(c.intro)}</Lead>
      {stats ? (
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[560px] text-[15px]">
            <thead>
              <tr className="border-b text-start text-[12px] tracking-[0.08em] uppercase" style={{ borderColor: "var(--site-line)", color: "var(--site-muted)" }}>
                <th className="py-3 text-start font-medium">Community</th>
                <th className="py-3 text-end font-medium">Listings</th>
                <th className="py-3 text-end font-medium">For sale</th>
                <th className="py-3 text-end font-medium">To let</th>
                <th className="py-3 text-end font-medium">Median asking per sq ft</th>
              </tr>
            </thead>
            <tbody>
              {areas.slice(0, 10).map((a) => (
                <tr key={a.community} className="border-b" style={{ borderColor: "var(--site-line)" }}>
                  <td className="py-3">{a.community}</td>
                  <td className="py-3 text-end font-mono tabular-nums">{a.listings}</td>
                  <td className="py-3 text-end font-mono tabular-nums">{a.forSale}</td>
                  <td className="py-3 text-end font-mono tabular-nums">{a.toLet}</td>
                  <td className="py-3 text-end font-mono tabular-nums">{a.medianPpsf ?? "No sales listed"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map((a) => (
            <li key={a.community} className="border p-5" style={{ borderColor: "var(--site-line)", background: "var(--site-surface)", borderRadius: "var(--site-radius)" }}>
              <p className="text-[17px]">{a.community}</p>
              <p className="mt-1 text-[13px]" style={{ color: "var(--site-muted)" }}>
                {a.city} · <span className="font-mono tabular-nums">{a.listings}</span> {a.listings === 1 ? "listing" : "listings"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Wrap>
  );
}

function Contact({ c, ctx }: { c: C; ctx: Ctx }) {
  return (
    <Wrap id="contact">
      <div className="grid gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div>
          <H2>{str(c.title, "Speak to an agent")}</H2>
          <Lead>{str(c.intro)}</Lead>
          <dl className="mt-8 space-y-2 text-[15px]">
            {ctx.contact.phone && <div>Telephone <span className="font-mono">{ctx.contact.phone}</span></div>}
            {ctx.contact.email && <div>Email {ctx.contact.email}</div>}
            {ctx.contact.address && <div style={{ color: "var(--site-muted)" }}>{ctx.contact.address}</div>}
          </dl>
        </div>
        <SiteContactForm slug={ctx.slug} />
      </div>
    </Wrap>
  );
}

export async function SiteBlock({ type, content, ctx }: { type: BlockType; content: C; ctx: Ctx }) {
  switch (type) {
    case "hero":
      return <Hero c={content} ctx={ctx} />;
    case "featured_listings":
      return <Featured c={content} ctx={ctx} />;
    case "agent_grid":
      return <Agents c={content} ctx={ctx} />;
    case "testimonials":
      return <Testimonials c={content} />;
    case "about":
      return <About c={content} />;
    case "areas":
      return <Areas c={content} ctx={ctx} />;
    case "market_stats":
      return <Areas c={content} ctx={ctx} stats />;
    case "contact":
      return <Contact c={content} ctx={ctx} />;
  }
}
