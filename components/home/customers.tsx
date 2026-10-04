"use client";

import { Button } from "@/components/ui/button";
import { useAccess } from "./access";
import { Heading, Lead, Reveal } from "./motion";

/*
 * Firms on the platform. Testimonials appear only when a firm has given one;
 * seeded demonstration workspaces are labelled as such; open places are shown
 * as open. To mark a firm as a customer, change its status here.
 */
type Firm = { name: string; city: string; status: "customer" | "demonstration"; metric: string; metricLabel: string; note: string };

const FIRMS: Firm[] = [
  { name: "PropFolios", city: "Abu Dhabi", status: "customer", metric: "AED 420M+", metricLabel: "advised", note: "The founding firm. Nakhla's research, underwriting and memo workflows ran on its mandates first." },
  { name: "Gulf Realty Advisors", city: "Dubai", status: "demonstration", metric: "AED", metricLabel: "Dubai off-plan desk", note: "Emaar and DAMAC mandates, RERA escrow checks and Oqood registration, end to end." },
  { name: "Bombay Property Intelligence", city: "Mumbai", status: "demonstration", metric: "INR", metricLabel: "Mumbai and Goa desk", note: "MahaRERA and Goa RERA projects, IGR transactions and Ready Reckoner rates, in lakh and crore." },
];

export function Customers() {
  const access = useAccess();
  return (
    <section id="firms" aria-label="Firms" className="home-noise relative scroll-mt-16">
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="max-w-[860px]">
          <Heading>Built with practitioners. Open to founding firms.</Heading>
          <Lead className="mt-6 max-w-[64ch]">One firm runs on Nakhla in production. Two demonstration workspaces show the UAE and India desks. Three founding places are open.</Lead>
        </Reveal>
        <ul className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {FIRMS.map((f, k) => (
            <Reveal as="li" key={f.name} delay={k * 0.1} className="flex flex-col rounded-md border border-hairline bg-surface p-6 md:p-8">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14px] font-medium tracking-[0.05em] text-navy-900 uppercase">{f.name}</div>
                  <div className="num mt-1 text-[12px] text-ink-500">{f.city}</div>
                </div>
                <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium " + (f.status === "customer" ? "bg-navy-900 text-surface" : "border border-hairline text-ink-500")}>{f.status === "customer" ? "In production" : "Demonstration workspace"}</span>
              </div>
              <div className="mt-8 flex items-baseline gap-2">
                <span className="num text-[32px] leading-none text-navy-900 tabular-nums">{f.metric}</span>
                <span className="text-[13px] text-ink-500">{f.metricLabel}</span>
              </div>
              <p className="mt-5 flex-1 font-display text-[18px] leading-[1.5] text-ink-700">{f.note}</p>
              <p className="mt-6 border-t border-hairline pt-4 text-[12px] text-ink-500">{f.status === "customer" ? "No testimonial published yet." : "Seeded with sample mandates, leads and listings."}</p>
            </Reveal>
          ))}
          {[4, 5, 6].map((n, k) => (
            <Reveal as="li" key={n} delay={(k + 3) * 0.1} className="flex flex-col rounded-md border border-dashed border-ink-200 p-6 md:p-8">
              <div className="text-[14px] font-medium tracking-[0.05em] text-ink-400 uppercase">Founding place</div>
              <div className="num mt-1 text-[12px] text-ink-400">{k + 1} of 3 open</div>
              <p className="mt-8 flex-1 font-display text-[18px] leading-[1.5] text-ink-500">For a brokerage in any of the six markets: a provisioned workspace, data migration and a direct line to the people building Nakhla.</p>
              <div className="mt-6">
                <Button variant="secondary" onClick={() => access.open("professional")}>
                  Request this place
                </Button>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
