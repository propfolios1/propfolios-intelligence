import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/composites/page-header";
import { LandRecordUpload } from "@/components/india/land-record-upload";
import { Flag, ReraStatus } from "@/components/os/badges";
import { RunAgent } from "@/components/os/run-agent";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { StructuredDetail } from "@/components/os/structured-detail";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import { lastOutput } from "@/lib/ai/agents/define";
import { requireRole } from "@/lib/auth";
import { formatInr } from "@/lib/format";
import { propertyFacts } from "@/lib/india/context";
import { RECORD_LABEL } from "@/lib/india/parsers";
import { taxQuote } from "@/lib/india/service";
import { lookupAll } from "@/lib/india/sources";

export const metadata = { title: "India property file" };
export const dynamic = "force-dynamic";

export default async function IndiaRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { ctx, results } = await lookupAll(await getDb(), user.tenantId, id);
  if (!ctx?.record) notFound();
  const r = ctx.record;
  const mh = r.state === "MH";
  const facts = propertyFacts(ctx);
  const quote = taxQuote({ jurisdiction: ctx.jurisdiction, value: facts.value, governmentValue: facts.governmentValue, underConstruction: facts.underConstruction, coOpSociety: facts.coOpSociety, landUse: facts.landUse, crzZone: facts.crzZone, mundkarStatus: facts.mundkarStatus, comunidade: facts.comunidade, conversionStatus: facts.conversionStatus, buyer: { gender: "male", residency: "nri" } });
  const [complianceLast, landLast, rrLast] = await Promise.all([lastOutput(user.tenantId, "maharera-compliance", id), lastOutput(user.tenantId, "goa-land-use", id), lastOutput(user.tenantId, "ready-reckoner", id)]);
  const flagged = results.filter((x) => x.flags.length);
  return (
    <PageContainer>
      <PageHeader
        eyebrow={<Link href={mh ? "/analyst/india/mumbai" : "/analyst/india/goa"}>{mh ? "India · Mumbai desk" : "India · Goa desk"}</Link>}
        title={ctx.property.name}
        subtitle={`${ctx.developer?.name ?? ""} · ${ctx.property.community} · ${r.village}, ${r.district}`}
        meta={
          <>
            <span>
              {r.reraAuthority} <span className="num">{r.reraNumber}</span>
            </span>
            <ReraStatus status={r.reraStatus} />
            <span className="num">From {formatInr(ctx.property.priceMin)}</span>
            <span>{flagged.length ? `${flagged.length} registers with findings` : "No register findings"}</span>
          </>
        }
        actions={
          <Link href={`/analyst/properties/${ctx.property.id}`} className="text-small text-navy-900 underline decoration-ink-200 underline-offset-4">
            Property profile
          </Link>
        }
      />

      <Section title="Register extracts" eyebrow="Sources" description="Every register for the state, read for this property. Mocked adapters over the workspace's records, in the register's own shape.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map((s) => (
            <article key={s.source} className="rounded-md border border-ink-200 bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <div className="eyebrow">{s.label}</div>
                {!s.found ? <Flag tone="neutral">Not on file</Flag> : s.flags.length ? <Flag tone="progress">{s.flags.length} findings</Flag> : <Flag tone="complete">Clear</Flag>}
              </div>
              <p className="mt-3 text-small text-ink-900">{s.summary}</p>
              {s.flags.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-4 text-small text-ink-700">
                  {s.flags.slice(0, 3).map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3 text-axis text-ink-500">{s.authority}</div>
            </article>
          ))}
        </div>
      </Section>

      <Section title={mh ? "MahaRERA compliance" : "Land use and title"} eyebrow={mh ? "Agent 14" : "Agent 15"} description={mh ? "Reads the register extracts above and returns a verdict per item and a complaint risk score; learns the developer's complaint pattern." : "Zoning, conversion, CRZ, Comunidade, mundkar and title chain, with the buyer's eligibility as an NRI."}>
        {mh ? (
          <RunAgent endpoint="/api/india/agents/maharera-compliance" body={{ propertyId: id }} agentLabel="MahaRERA compliance" initial={complianceLast ? { output: complianceLast.output as never, model: complianceLast.model, costUsd: complianceLast.costUsd, at: complianceLast.at } : null} />
        ) : (
          <RunAgent endpoint="/api/india/agents/goa-land-use" body={{ propertyId: id, buyerResidency: "nri", purpose: "holiday_home" }} agentLabel="Goa land use" initial={landLast ? { output: landLast.output as never, model: landLast.model, costUsd: landLast.costUsd, at: landLast.at } : null} />
        )}
      </Section>

      <Section title="Ready Reckoner and price" eyebrow="Agent 18" description={`${r.readyReckonerZone ?? "Zone not mapped"} · ${r.readyReckonerRate ? `${formatInr(r.readyReckonerRate, { compact: false })} per sq m` : "no rate"} · carpet area ${facts.carpetAreaSqm} sq m.`}>
        <RunAgent endpoint="/api/india/agents/ready-reckoner" body={{ propertyId: id }} agentLabel="Ready Reckoner" initial={rrLast ? { output: rrLast.output as never, model: rrLast.model, costUsd: rrLast.costUsd, at: rrLast.at } : null} />
      </Section>

      <Section title="Transaction costs" eyebrow="Rules engine" description={`Entry unit at ${formatInr(facts.value)} for an NRI buyer. Rates as of ${quote.plugin.ratesAsOf}.`} actions={<Link href={`/analyst/india/tax-calculator?jurisdiction=${ctx.jurisdiction}&value=${facts.value}`} className="text-small text-navy-900 underline decoration-ink-200 underline-offset-4">Open in the calculator</Link>}>
        <SimpleTable
          rows={quote.breakdown.lines}
          minWidth={640}
          columns={[
            { key: "l", header: "Item", cell: (l) => <span className="text-ink-900">{l.label}</span> },
            { key: "p", header: "Payer", cell: (l) => l.payer },
            { key: "a", header: "Amount", numeric: true, cell: (l) => formatInr(l.amount, { compact: false }) },
            { key: "r", header: "Reference", cell: (l) => l.reference },
          ]}
        />
        <div className="mt-3 flex flex-wrap gap-6 text-small text-ink-700">
          <span>
            Buyer total <span className="num text-ink-900">{formatInr(quote.breakdown.buyerTotal, { compact: false })}</span> (<span className="num">{quote.breakdown.buyerCostPct}%</span>)
          </span>
          {quote.validation.errors.map((e) => (
            <Flag key={e.code} tone="error">
              {e.message}
            </Flag>
          ))}
          {quote.validation.warnings.slice(0, 3).map((w) => (
            <span key={w.code} className="text-warning">
              {w.message}
            </span>
          ))}
        </div>
      </Section>

      <Section title="Land records" eyebrow="Parsers" description="Parsed records on file and the upload for new ones.">
        <div className="space-y-4">
          {ctx.land.map((l) => (
            <details key={l.id} className="rounded-md border border-ink-200 bg-surface p-5 shadow-card">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3">
                <span className="font-medium text-ink-900">{RECORD_LABEL[l.recordType as keyof typeof RECORD_LABEL]}</span>
                <span className="flex items-center gap-3 text-small text-ink-500">
                  <span className="num">{Math.round(l.confidence * 100)}%</span>
                  {l.warnings.length ? <Flag tone="progress">{l.warnings.length} findings</Flag> : <Flag tone="complete">Clear</Flag>}
                </span>
              </summary>
              {l.warnings.length > 0 && (
                <ul className="mt-4 list-disc space-y-1 pl-5 text-small text-ink-700">
                  {l.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
              <StructuredDetail output={l.parsed} className="mt-4" />
              <pre className="mt-4 overflow-x-auto rounded-sm bg-navy-50 p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-ink-700">{l.sourceText}</pre>
            </details>
          ))}
          <LandRecordUpload propertyId={id} state={r.state} />
        </div>
      </Section>
    </PageContainer>
  );
}
