"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { Eyebrow, Heading, Lead, Reveal } from "./motion";

const PHONES = [
  { src: "/home/m-leads.jpg", alt: "Leads board on a phone", rotate: -6, y: 24, label: "Analyst desk" },
  { src: "/home/m-portfolio.jpg", alt: "Client portfolio on a phone", rotate: 0, y: 0, label: "Client portal" },
  { src: "/home/m-notifications.jpg", alt: "Notifications on a phone", rotate: 6, y: 24, label: "Notifications" },
];

const POINTS = ["Every screen designed and tested at 375 pixels wide", "The client portal, statements and memos on any phone", "Leads, deals and approvals from the browser, nothing to install", "Native iOS and Android apps on the roadmap"];

export function Mobile() {
  return (
    <section id="mobile" aria-label="Mobile" className="home-noise relative scroll-mt-16 overflow-hidden border-y border-hairline bg-surface">
      <div className="relative mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-16 px-4 py-24 md:px-8 md:py-32 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Reveal>
          <Eyebrow gold>Mobile</Eyebrow>
          <Heading className="mt-4">Nakhla in your pocket.</Heading>
          <Lead className="mt-6 max-w-[48ch]">The whole platform runs in a phone&apos;s browser: the analyst desk, the client portal and every notification, laid out for the screen in your hand.</Lead>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p, k) => (
              <li key={p} className={"flex items-start gap-3 text-[15px] " + (k === POINTS.length - 1 ? "text-ink-500" : "text-ink-900")}>
                <Check className={"mt-1 size-4 shrink-0 stroke-[1.5] " + (k === POINTS.length - 1 ? "text-ink-300" : "text-success")} aria-hidden />
                {p}
              </li>
            ))}
          </ul>
        </Reveal>
        <div className="flex items-start justify-center gap-3 sm:gap-6">
          {PHONES.map((p, k) => (
            <Reveal key={p.src} delay={0.08 * k} className={k === 1 ? "" : "hidden sm:block"}>
              <figure className="group" style={{ transform: `translateY(${p.y}px) rotate(${p.rotate}deg)` }}>
                <div className="w-[200px] overflow-hidden rounded-[12px] border-[6px] border-navy-950 bg-navy-950 shadow-[0_8px_24px_rgba(10,31,68,0.08)] transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-2 group-hover:rotate-[-1deg] md:w-[220px]">
                  <Image src={p.src} alt={p.alt} width={390} height={844} sizes="220px" className="block h-auto w-full rounded-[6px]" />
                </div>
                <figcaption className="mt-4 text-center text-[12px] text-ink-500">{p.label}</figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
