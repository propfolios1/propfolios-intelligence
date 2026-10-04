"use client";

import {
  FileLock2,
  Fingerprint,
  Landmark,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Heading, Lead, Reveal } from "./motion";

// Statuses state what exists today. Nakhla holds no certification yet; it ships the controls each regime asks for.
const BADGES: {
  icon: LucideIcon;
  name: string;
  status: string;
  tone: "built" | "planned";
  body: string;
}[] = [
  {
    icon: ShieldCheck,
    name: "SOC 2 Type II",
    status: "Planned",
    tone: "planned",
    body: "No audit has started. The controls an auditor tests are in place today: role-based access, tenant isolation, and an audit trail with before and after snapshots of every change.",
  },
  {
    icon: FileLock2,
    name: "GDPR",
    status: "Workflows built in",
    tone: "built",
    body: "Access, portability, rectification and erasure requests tracked to their statutory due dates, with consent recorded per purpose.",
  },
  {
    icon: Landmark,
    name: "UAE PDPL",
    status: "Workflows built in",
    tone: "built",
    body: "Data subject requests logged against PDPL timelines, retention set per jurisdiction, and data hosted in the region the firm chooses.",
  },
  {
    icon: Fingerprint,
    name: "India DPDP Act",
    status: "Workflows built in",
    tone: "built",
    body: "Consent and data principal requests under the DPDP Act; erasure keeps records required by AML and tax law in pseudonymised form.",
  },
];

export function Security({ policies }: { policies: number }) {
  return (
    <section
      id="security"
      aria-label="Security and compliance"
      className="home-noise relative scroll-mt-16 border-y border-hairline bg-surface"
    >
      <div className="relative mx-auto w-full max-w-[1280px] px-4 py-24 md:px-8 md:py-32">
        <Reveal className="max-w-[860px]">
          <Heading>Enterprise-grade trust.</Heading>
          <Lead className="mt-6 max-w-[64ch]">
            Isolation, auditability and data rights are part of the data model,
            not a policy document.
          </Lead>
        </Reveal>
        <ul className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-2">
          {BADGES.map((b, k) => {
            const Icon = b.icon;
            return (
              <Reveal
                as="li"
                key={b.name}
                delay={k * 0.06}
                className="flex gap-5 rounded-md border border-hairline bg-canvas p-6 md:p-8"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-navy-100 bg-surface text-navy-900">
                  <Icon className="size-5 stroke-[1.5]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-[18px] font-medium text-navy-900">
                      {b.name}
                    </h3>
                    <span
                      className={
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium " +
                        (b.tone === "built"
                          ? "bg-navy-900 text-surface"
                          : "border border-hairline text-ink-500")
                      }
                    >
                      {b.status}
                    </span>
                  </div>
                  <p className="mt-2 text-[14px] leading-[1.6] text-ink-700">
                    {b.body}
                  </p>
                </div>
              </Reveal>
            );
          })}
        </ul>
        <Reveal className="mt-10 max-w-[80ch]">
          <p className="text-[16px] leading-[1.65] text-ink-700">
            Every action is audit-logged. Every tenant is isolated at the
            database level
            {policies ? (
              <>
                {" "}
                with <span className="num text-ink-900">{policies}</span>{" "}
                row-level security policies
              </>
            ) : null}
            . Key agent outputs are cross-validated across three models, and
            disagreement goes to a person.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
