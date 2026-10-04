"use client";

import { motion, useReducedMotion } from "framer-motion";
import type * as React from "react";

export const EASE = [0.16, 1, 0.3, 1] as const;
/** Scroll reveals start once the element is 100px inside the viewport. */
export const VIEWPORT = { once: true, margin: "0px 0px -100px 0px" } as const;

/** Section entrance: fade and rise 24px over 600ms. */
export function Reveal({ children, delay = 0, className, as = "div", y = 24 }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "li" | "section" | "header"; y?: number }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag className={className} initial={reduce ? false : { opacity: 0, y }} whileInView={{ opacity: 1, y: 0 }} viewport={VIEWPORT} transition={{ duration: 0.6, ease: EASE, delay }}>
      {children}
    </Tag>
  );
}

/** Section frame: one gutter, one maximum width, one vertical rhythm, an optional grid backdrop. */
export function Section({ id, children, className, inner, grid = false, label }: { id?: string; children: React.ReactNode; className?: string; inner?: string; grid?: boolean; label?: string }) {
  return (
    <section id={id} aria-label={label} className={"home-noise relative scroll-mt-16 " + (grid ? "home-grid " : "") + (className ?? "")}>
      <div className={"relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32 " + (inner ?? "")}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children, gold = false }: { children: React.ReactNode; gold?: boolean }) {
  return <div className={"text-[11px] font-medium tracking-[0.14em] uppercase " + (gold ? "text-gold-600" : "text-ink-500")}>{children}</div>;
}

/** Section title: Playfair 56px at desktop. */
export function Heading({ children, className, as: Tag = "h2" }: { children: React.ReactNode; className?: string; as?: "h2" | "h3" }) {
  return <Tag className={"font-display text-[36px] leading-[1.06] font-normal tracking-[-0.025em] text-navy-900 md:text-[48px] lg:text-[56px] " + (className ?? "")}>{children}</Tag>;
}

export function Lead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={"text-[17px] leading-[1.6] text-ink-700 md:text-[18px] " + (className ?? "")}>{children}</p>;
}

/** Keyboard key, styled the same everywhere a shortcut appears. */
export function Key({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={"num inline-flex h-6 min-w-6 items-center justify-center rounded-[4px] border border-hairline bg-surface px-1.5 text-[11px] leading-none text-ink-700 shadow-[inset_0_-1px_0_rgba(10,31,68,0.08)] " + (className ?? "")}>{children}</kbd>;
}
