"use client";

import { motion, useReducedMotion } from "framer-motion";
import type * as React from "react";

export const EASE = [0.16, 1, 0.3, 1] as const;
/** Scroll reveals start once the element is 100px inside the viewport. */
export const VIEWPORT = { once: true, margin: "0px 0px -100px 0px" } as const;

/** Fade in and rise 12px when scrolled into view. */
export function Reveal({ children, delay = 0, className, as = "div" }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "li" | "section" | "header" }) {
  const reduce = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT}
      transition={{ duration: 0.4, ease: EASE, delay }}
    >
      {children}
    </Tag>
  );
}

/** Section frame: one gutter, one maximum width, one vertical rhythm. */
export function Section({ id, children, className, inner }: { id?: string; children: React.ReactNode; className?: string; inner?: string }) {
  return (
    <section id={id} className={className}>
      <div className={"mx-auto w-full max-w-[1200px] px-4 py-20 md:px-8 md:py-28 " + (inner ?? "")}>{children}</div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-medium tracking-[0.12em] text-ink-500 uppercase">{children}</div>;
}

export function Heading({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={"font-display text-[28px] leading-[1.1] font-normal tracking-[-0.02em] text-navy-900 md:text-[40px] " + (className ?? "")}>{children}</h2>;
}
