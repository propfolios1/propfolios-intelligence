"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type NavSegment = { slug: string; name: string; size: string; menu: string };

const LINK = "rounded-sm px-3 py-2 text-[14px] text-ink-700 transition-colors duration-150 hover:bg-navy-900/[0.04] hover:text-ink-900";

/** Product, Solutions, Pricing, Docs; Sign in and Start free trial. Solutions opens a menu; small screens get a sheet. */
export function SiteNav({ segments, signInHref }: { segments: NavSegment[]; signInHref: string }) {
  const [open, setOpen] = React.useState<"solutions" | "mobile" | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  React.useEffect(() => setOpen(null), [pathname]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    const onClick = (e: MouseEvent) => open === "solutions" && !menuRef.current?.contains(e.target as Node) && setOpen(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <>
      <nav aria-label="Site" className="hidden items-center gap-1 lg:flex">
        <Link href="/#product" className={LINK}>
          Product
        </Link>
        <div ref={menuRef} className="relative">
          <button type="button" aria-expanded={open === "solutions"} aria-haspopup="true" onClick={() => setOpen(open === "solutions" ? null : "solutions")} className={cn(LINK, "inline-flex items-center gap-1", active("/solutions") && "text-ink-900")}>
            Solutions <ChevronDown className={cn("size-3.5 transition-transform duration-150", open === "solutions" && "rotate-180")} aria-hidden />
          </button>
          {open === "solutions" && (
            <div className="absolute top-full left-1/2 z-50 mt-2 w-[440px] -translate-x-1/2 rounded-lg border border-hairline bg-surface p-2 shadow-[0_8px_24px_rgba(10,31,68,0.08)]">
              {segments.map((s) => (
                <Link key={s.slug} href={`/solutions/${s.slug}`} className="block rounded-md px-3 py-2.5 transition-colors duration-150 hover:bg-navy-50">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-ui font-medium text-ink-900">{s.name}</span>
                    <span className="num text-[11px] text-ink-500">{s.size}</span>
                  </span>
                  <span className="mt-0.5 block text-small text-ink-500">{s.menu}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <Link href="/pricing" className={cn(LINK, active("/pricing") && "text-ink-900")}>
          Pricing
        </Link>
        <Link href="/docs" className={cn(LINK, active("/docs") && "text-ink-900")}>
          Docs
        </Link>
      </nav>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
          <Link href={signInHref}>Sign in</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/trial">Start free trial</Link>
        </Button>
        <button type="button" aria-label={open === "mobile" ? "Close menu" : "Open menu"} aria-expanded={open === "mobile"} onClick={() => setOpen(open === "mobile" ? null : "mobile")} className="inline-flex size-9 items-center justify-center rounded-sm text-ink-700 hover:bg-navy-900/[0.04] lg:hidden">
          {open === "mobile" ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      {open === "mobile" && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto border-t border-hairline bg-bg px-4 py-6 lg:hidden">
          <nav aria-label="Site" className="flex flex-col">
            {[
              ["/#product", "Product"],
              ["/pricing", "Pricing"],
              ["/docs", "Docs"],
              ["/faq", "Questions"],
              ["/security", "Security"],
            ].map(([h, l]) => (
              <Link key={h} href={h} className="border-b border-hairline py-3 text-read text-ink-900">
                {l}
              </Link>
            ))}
            <div className="eyebrow mt-6 mb-2">Solutions</div>
            {segments.map((s) => (
              <Link key={s.slug} href={`/solutions/${s.slug}`} className="border-b border-hairline py-3">
                <span className="text-read text-ink-900">{s.name}</span>
                <span className="num ml-2 text-small text-ink-500">{s.size}</span>
              </Link>
            ))}
            <Link href={signInHref} className="mt-6 text-ui text-navy-900 underline decoration-ink-200 underline-offset-4">
              Sign in
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
