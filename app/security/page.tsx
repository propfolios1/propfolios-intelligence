import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { subprocessors } from "@/lib/enterprise/residency";
import { GRANTABLE } from "@/lib/enterprise/roles";
import { ACCESS_ROLES } from "@/lib/rbac/permissions";
import { securityStats } from "@/lib/security/stats";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Security and compliance",
  description: "How Nakhla isolates each firm's data, encrypts it, controls access, audits every action and meets GDPR, the UAE PDPL and India's DPDP Act.",
};
export const dynamic = "force-dynamic";

const FIRM_ROLES = ACCESS_ROLES.filter((r) => !r.startsWith("platform_")).length;

type Status = "in_place" | "in_progress" | "planned";
const STATUS: Record<Status, { label: string; cls: string }> = {
  in_place: { label: "In place", cls: "border-success/40 text-success" },
  in_progress: { label: "In progress", cls: "border-warning/40 text-warning" },
  planned: { label: "Planned", cls: "border-hairline text-ink-500" },
};

const FRAMEWORKS: { name: string; scope: string; status: Status; detail: string }[] = [
  {
    name: "SOC 2 Type II",
    scope: "Security, availability and confidentiality",
    status: "in_progress",
    detail: "Controls are being prepared against the Trust Services Criteria. The audit we planned for the second quarter of 2026 has not yet started; we will publish the audit firm and observation window here once engaged. Nakhla does not hold a SOC 2 report today.",
  },
  {
    name: "EU and UK GDPR",
    scope: "Firms with clients or staff in Europe or the United Kingdom",
    status: "in_place",
    detail: "Nakhla acts as processor; the firm is controller. A Data Processing Agreement under Article 28, with the 2021 Standard Contractual Clauses and the UK Addendum for transfers, is available on request. Access, rectification, erasure and portability requests are handled in the product.",
  },
  {
    name: "UAE PDPL",
    scope: "Federal Decree-Law No. 45 of 2021, with DIFC DP Law 2020 and ADGM DPR 2021 for free-zone firms",
    status: "in_place",
    detail: "Consent and lawful-basis records per client, data subject request handling, breach notification procedures and a sub-processor register. In-country storage is available as a dedicated deployment for firms whose clients require it.",
  },
  {
    name: "India DPDP Act 2023",
    scope: "Firms serving Indian residents and NRIs",
    status: "in_place",
    detail: "Itemised consent notices, consent withdrawal, data principal rights requests and grievance contacts. Storage in Mumbai keeps Indian clients' records in India. Obligations under the DPDP Rules 2025 are tracked as they take effect.",
  },
  {
    name: "Anti-money-laundering record keeping",
    scope: "UAE goAML, India FIU-IND, UK HMRC supervision, Singapore CEA",
    status: "in_place",
    detail: "Customer due diligence files, screening results and reports are kept for seven years, beyond the five-year statutory minimums, and cannot be edited after decision.",
  },
  {
    name: "Independent penetration test",
    scope: "Application, API and infrastructure configuration",
    status: "planned",
    detail: "An annual test by an independent, CREST-accredited firm. The first engagement is being scoped. Enterprise customers receive the summary letter under NDA once it is issued, and findings rated high or critical are fixed before the letter is released.",
  },
];

const LAYERS = [
  { n: "01", title: "Application", body: "Every query runs through a tenant-scoped data layer. A query on a firm's table without the firm's identifier throws before it reaches the database, so a missing filter fails loudly rather than leaking." },
  { n: "02", title: "Database", body: "Row-level security policies on every firm table read the firm and role from the signed session token. Even a query that bypassed the application would return only the caller's own firm's rows; clients see only their own records." },
  { n: "03", title: "Storage", body: "Documents, memos, branding and avatars sit in private buckets under a path that begins with the firm's identifier. Storage policies check that prefix on every read and write; files are served through short-lived signed links." },
];

const CONTROLS: { title: string; items: string[] }[] = [
  { title: "Encryption", items: ["AES-256 at rest for the database, backups and file storage", "TLS 1.2 or later for every connection, with HSTS", "Integration credentials (portal, WhatsApp, developer feeds) sealed with AES-256-GCM in the application before they are stored", "Passwords are never stored by Nakhla; sign-in is handled by Clerk"] },
  { title: "Identity and access", items: ["Single sign-on with SAML 2.0 or OpenID Connect, with domain verification and enforcement", "SCIM 2.0 provisioning: leavers lose access as soon as the identity provider removes them", "Multi-factor authentication on every account, and enforceable through the firm's identity provider", `${FIRM_ROLES} built-in access roles, and custom roles composed from ${GRANTABLE.length} permissions`, "API keys with scopes, per-minute limits, expiry and usage by route"] },
  { title: "Audit", items: ["Every action by a person, an AI agent or the system, with before and after values, IP address and request ID", "Every agent run records its model, prompt version, tokens, duration and cost", "Export to CSV or JSON Lines with a SHA-256 digest and signature, ready for a SIEM", "Audit records kept for seven years and not editable in the product"] },
  { title: "AI", items: ["Agents run on Anthropic's commercial API, whose terms exclude customer content from model training", "Each request carries only the firm's own records; agent memory is scoped to the firm", "Administrators switch individual agents off and set a monthly AI budget", "Material outputs are cross-checked by a second model, and disagreements are flagged for human review"] },
  { title: "Operations", items: ["Point-in-time recovery and daily backups held in the same region as the data", "Scheduled jobs run in the database (Supabase Cron) and call authenticated functions", "Dependencies are pinned by lockfile; secrets live in the hosting provider's encrypted settings, never in code", "Trial workspaces are read-only from day 14 and permanently deleted on day 60"] },
];

export default async function SecurityPage() {
  const stats = await getDb()
    .then((db) => securityStats(db))
    .catch(() => null);
  const strip = [
    { value: stats ? stats.rlsPolicies.toLocaleString("en-GB") : "n/a", label: "Row-level security policies", note: "Counted on the live database when this page was served" },
    { value: stats ? `${stats.rlsTables} of ${stats.publicTables}` : "n/a", label: "Tables under row-level security", note: stats && stats.rlsTables === stats.publicTables ? "Every table in the application schema" : "The remainder hold platform catalogues with no firm data" },
    { value: "AES-256", label: "Encryption at rest", note: "Database, backups, files and sealed credentials" },
    { value: "7 years", label: "Audit and AML retention", note: "Beyond the five-year statutory minimums" },
  ];
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pt-12 pb-24 sm:px-6 md:px-12 xl:px-20">
        <div className="max-w-[760px]">
          <div className="eyebrow">Security and compliance</div>
          <h1 className="mt-4 font-display text-[40px] leading-[1.1] text-navy-900 md:text-[56px]">Your clients&rsquo; records, held to the standard their bank expects.</h1>
          <p className="mt-6 text-read text-ink-700">Brokerages keep passports, source-of-funds evidence, offers and commission splits in Nakhla. This page sets out how that data is isolated, encrypted, accessed and audited, and where our compliance programme stands today, including what is not finished yet.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild>
              <a href="mailto:privacy@nakhla.ai?subject=Data%20Processing%20Agreement%20request">Request the DPA</a>
            </Button>
            <Button asChild variant="secondary">
              <a href="#disclosure">Report a vulnerability</a>
            </Button>
          </div>
        </div>

        <dl className="mt-16 grid grid-cols-1 border-y border-hairline sm:grid-cols-2 lg:grid-cols-4">
          {strip.map((s, i) => (
            <div key={s.label} className={cn("py-6 sm:px-6", i > 0 && "border-t border-hairline sm:border-t-0", i % 2 === 1 && "sm:border-l", i >= 2 && "lg:border-l sm:border-t lg:border-t-0")}>
              <dd className="num text-[32px] leading-none text-navy-900">{s.value}</dd>
              <dt className="mt-3 text-ui font-medium text-ink-900">{s.label}</dt>
              <p className="mt-1 text-small text-ink-500">{s.note}</p>
            </div>
          ))}
        </dl>

        <section className="mt-24" aria-labelledby="isolation">
          <div className="max-w-[640px]">
            <div className="eyebrow">Tenant isolation</div>
            <h2 id="isolation" className="mt-3 font-display text-[32px] leading-tight text-navy-900">Three independent layers keep each firm&rsquo;s data its own</h2>
            <p className="mt-4 text-body text-ink-700">Any one layer would stop a cross-firm read. All three run on every request, and the test suite attempts cross-firm access against each of them before every release.</p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline md:grid-cols-3">
            {LAYERS.map((l) => (
              <div key={l.n} className="bg-surface p-6">
                <div className="num text-small text-gold-600">{l.n}</div>
                <h3 className="mt-3 text-read font-medium text-ink-900">{l.title}</h3>
                <p className="mt-2 text-small leading-relaxed text-ink-700">{l.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24" aria-labelledby="controls">
          <div className="max-w-[640px]">
            <div className="eyebrow">Controls</div>
            <h2 id="controls" className="mt-3 font-display text-[32px] leading-tight text-navy-900">What protects the data day to day</h2>
          </div>
          <div className="mt-10 grid gap-x-12 gap-y-10 md:grid-cols-2">
            {CONTROLS.map((c) => (
              <div key={c.title} className="border-t border-hairline pt-5">
                <h3 className="text-read font-medium text-ink-900">{c.title}</h3>
                <ul className="mt-3 space-y-2">
                  {c.items.map((i) => (
                    <li key={i} className="flex gap-3 text-small text-ink-700">
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-navy-700" aria-hidden />
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24" aria-labelledby="programme">
          <div className="max-w-[640px]">
            <div className="eyebrow">Compliance programme</div>
            <h2 id="programme" className="mt-3 font-display text-[32px] leading-tight text-navy-900">Where we stand, stated plainly</h2>
            <p className="mt-4 text-body text-ink-700">We list each framework with its real status. Nakhla does not claim a certification it has not been awarded.</p>
          </div>
          <div className="mt-10 divide-y divide-hairline rounded-md border border-hairline bg-surface">
            {FRAMEWORKS.map((f) => (
              <div key={f.name} className="grid gap-3 p-6 md:grid-cols-[260px_120px_minmax(0,1fr)] md:gap-8">
                <div>
                  <h3 className="text-read font-medium text-ink-900">{f.name}</h3>
                  <p className="mt-1 text-small text-ink-500">{f.scope}</p>
                </div>
                <div>
                  <span className={cn("inline-flex h-6 items-center rounded-full border px-2.5 text-[11px] font-medium tracking-[0.06em] uppercase", STATUS[f.status].cls)}>{STATUS[f.status].label}</span>
                </div>
                <p className="text-small leading-relaxed text-ink-700">{f.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24" aria-labelledby="subprocessors">
          <div className="max-w-[640px]">
            <div className="eyebrow">Sub-processors</div>
            <h2 id="subprocessors" className="mt-3 font-display text-[32px] leading-tight text-navy-900">Every service that touches the data, and where</h2>
            <p className="mt-4 text-body text-ink-700">Enterprise firms choose the storage region: Mumbai, Frankfurt, London, Singapore, Sydney or North Virginia, or a dedicated UAE deployment. AI requests are processed in the United States in every case.</p>
          </div>
          <div className="mt-10 overflow-x-auto rounded-md border border-hairline bg-surface">
            <table className="w-full min-w-[720px] text-small">
              <thead className="border-b border-hairline text-left">
                <tr className="eyebrow">
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">Purpose</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {subprocessors().map((p) => (
                  <tr key={p.name}>
                    <td className="px-5 py-3 align-top text-ink-900">{p.name}</td>
                    <td className="px-5 py-3 align-top text-ink-700">{p.purpose}</td>
                    <td className="px-5 py-3 align-top text-ink-700">{p.location}</td>
                    <td className="px-5 py-3 align-top text-ink-500">{p.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="disclosure" className="mt-24 scroll-mt-24 grid gap-10 md:grid-cols-2" aria-labelledby="disclosure-title">
          <div>
            <div className="eyebrow">Responsible disclosure</div>
            <h2 id="disclosure-title" className="mt-3 font-display text-[32px] leading-tight text-navy-900">Found a vulnerability? Tell us first.</h2>
            <p className="mt-4 text-body text-ink-700">
              Write to <a href="mailto:security@nakhla.ai" className="text-navy-900 underline decoration-ink-200 underline-offset-4">security@nakhla.ai</a> with the steps to reproduce. Our contact details are also published at <Link href="/.well-known/security.txt" className="num text-navy-900 underline decoration-ink-200 underline-offset-4">/.well-known/security.txt</Link>.
            </p>
          </div>
          <ul className="divide-y divide-hairline border-y border-hairline">
            {[
              ["Acknowledgement", "Within two business days"],
              ["Triage and severity", "Within five business days, using CVSS 3.1"],
              ["Fix for critical findings", "Within 14 days, with an update to you at each step"],
              ["Safe harbour", "Good-faith research within this policy will not meet legal action from Nakhla"],
              ["Out of scope", "Social engineering, denial of service, and testing against other customers' workspaces"],
              ["Recognition", "Credit in our security acknowledgements; a paid bug bounty programme opens with general availability of Enterprise"],
            ].map(([k, v]) => (
              <li key={k} className="grid grid-cols-[160px_1fr] gap-4 py-3 text-small">
                <span className="text-ink-500">{k}</span>
                <span className="text-ink-900">{v}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-24 flex flex-col items-start justify-between gap-6 rounded-md border border-hairline bg-surface p-8 md:flex-row md:items-center">
          <div className="max-w-[560px]">
            <h2 className="font-display text-[24px] text-navy-900">Completing a security review?</h2>
            <p className="mt-2 text-small text-ink-700">We answer vendor questionnaires (CAIQ, SIG Lite or your own) within five business days and can walk your IT team through the architecture.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href="/docs/compliance">Compliance documentation</Link>
            </Button>
            <Button asChild>
              <a href="mailto:security@nakhla.ai?subject=Security%20review">Contact security</a>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
