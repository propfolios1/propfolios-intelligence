"use client";

import Link from "next/link";
import * as React from "react";
import { Eyebrow, Heading, Lead, Reveal, Section } from "./motion";

const TABS = [
  { key: "webhooks", label: "Webhooks", file: "deal.closed", code: `POST https://hooks.yourfirm.com/nakhla\nNakhla-Event: deal.closed\nNakhla-Signature: t=1790000000,v1=5257a869…\n\n{\n  "type": "deal.closed",\n  "data": {\n    "deal_id": "8c1f…",\n    "summary": "DL-0219: Marina Gate 2BR closed at AED 2,450,000"\n  }\n}` },
  { key: "api", label: "REST", file: "curl", code: `curl https://app.nakhla.ai/api/leads/inbound/website \\\n  -H "Authorization: Bearer nk_live_…" \\\n  -d '{"name":"Aisha Rahman","phone":"+971501234567",\n       "listing_reference":"LS-0001"}'\n\n201 {"reference":"LD-0412","matchedListing":true}` },
  { key: "mcp", label: "MCP", file: "Claude Code", code: `claude mcp add --transport http nakhla \\\n  https://app.nakhla.ai/api/mcp \\\n  --header "Authorization: Bearer nk_live_…"\n\n> Which of our listings in Dubai Marina\n> have had no viewing in 30 days?` },
] as const;

export function Developers() {
  const [tab, setTab] = React.useState<(typeof TABS)[number]["key"]>("webhooks");
  const t = TABS.find((x) => x.key === tab)!;
  return (
    <Section id="developers" label="Developer platform">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
        <Reveal>
          <Eyebrow>Developer platform</Eyebrow>
          <Heading className="mt-4">Connects to the systems you already run.</Heading>
          <Lead className="mt-6">Signed webhooks when leads arrive and deals close, a documented REST API with scoped keys and rate limits, and an MCP server so your assistants can work with the firm&rsquo;s data under the same permissions as your staff.</Lead>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
            <Link href="/docs/api" className="text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
              API reference
            </Link>
            <Link href="/docs/webhooks" className="text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
              Webhooks
            </Link>
            <Link href="/docs/mcp" className="text-navy-900 underline decoration-ink-200 underline-offset-4 hover:decoration-navy-900">
              MCP server
            </Link>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="overflow-hidden rounded-[16px] border border-navy-800 bg-navy-900">
            <div role="tablist" aria-label="Interfaces" className="flex gap-1 border-b border-navy-800 px-3 pt-3">
              {TABS.map((x) => (
                <button key={x.key} role="tab" aria-selected={tab === x.key} onClick={() => setTab(x.key)} className={"rounded-t-[6px] px-3 py-2 text-[13px] transition-colors duration-150 " + (tab === x.key ? "bg-navy-800 text-surface" : "text-navy-100/70 hover:text-surface")}>
                  {x.label}
                </button>
              ))}
              <span className="num ml-auto self-center pr-2 text-[11px] text-navy-100/50">{t.file}</span>
            </div>
            <pre className="num min-h-[260px] overflow-x-auto p-5 text-[13px] leading-[1.65] text-navy-100" role="tabpanel">
              <code>{t.code}</code>
            </pre>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
