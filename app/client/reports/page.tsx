import Link from "next/link";
import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { Button } from "@/components/ui/button";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { clientReportList } from "@/lib/market-intel/service";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

const KIND = { annual: "Annual review", quarterly: "Quarterly report", ad_hoc: "Portfolio report", market_brief: "Market brief" } as const;

export default async function ClientReports({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const { kind = "all" } = await searchParams;
  const db = await getDb();
  const all = user.clientId ? await clientReportList(db, user.tenantId, user.clientId) : [];
  const briefs = all.filter((r) => r.type === "market_brief");
  const portfolio = all.filter((r) => r.type !== "market_brief");
  const shown = kind === "market" ? briefs : kind === "portfolio" ? portfolio : all;
  const tabs = [
    ["all", "All", all.length],
    ["market", "Market briefs", briefs.length],
    ["portfolio", "Portfolio reports", portfolio.length],
  ] as const;
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Reporting"
        title="Reports"
        subtitle="Quarterly reviews and annual letters on your portfolio, and market briefs on the areas you follow."
        actions={
          <Button asChild variant="secondary">
            <Link href="/client/subscriptions">Market subscriptions</Link>
          </Button>
        }
      />
      <nav className="mt-6 flex gap-1 border-b border-hairline" aria-label="Report type">
        {tabs.map(([k, l, c]) => (
          <Link key={k} href={k === "all" ? "/client/reports" : `/client/reports?kind=${k}`} className={`-mb-px border-b-2 px-3 py-2 text-ui ${kind === k ? "border-navy-900 text-navy-900" : "border-transparent text-ink-500 hover:text-ink-900"}`} aria-current={kind === k ? "page" : undefined}>
            {l} <span className="num text-ink-400">{c}</span>
          </Link>
        ))}
      </nav>
      {!shown.length && (
        <div className="mt-8">
          {kind === "market" ? (
            <EmptyState glyph="opportunities" headline="No market briefs yet" note="Follow a market to receive a brief on prices, new listings and developer releases in the areas you care about." primary={{ label: "Follow a market", href: "/client/subscriptions" }} />
          ) : (
            <EmptyState glyph="documents" headline="No reports yet" note="Your first quarterly report arrives at the start of next quarter: performance, income, valuations and the outlook for each holding." primary={{ label: "Follow a market", href: "/client/subscriptions" }} secondary={{ label: "View portfolio", href: "/client/portfolio" }} />
          )}
        </div>
      )}
      {shown.length > 0 && (
      <ul className="mt-6 divide-y divide-hairline rounded-md border border-hairline bg-surface">
        {shown.map((r) => (
          <li key={r.id}>
            <Link href={`/client/reports/${r.id}`} className="grid gap-2 p-5 transition-colors duration-150 hover:bg-ink-50 md:grid-cols-[160px_minmax(0,1fr)_120px] md:items-baseline md:gap-6">
              <div className="eyebrow">
                {KIND[r.type]}
                {!r.viewedAt && user.role === "client" && <span className="ml-2 inline-block size-1.5 rounded-full bg-gold-500 align-middle" aria-label="Unread" />}
              </div>
              <div className="min-w-0">
                <div className="truncate font-display text-[18px] text-navy-900">{r.title}</div>
                <p className="mt-1 line-clamp-2 text-small text-ink-700">{r.content.headline}</p>
              </div>
              <div className="num text-small text-ink-500 md:text-right">{formatDate(r.generatedAt, "short")}</div>
            </Link>
          </li>
        ))}
      </ul>
      )}
    </PageContainer>
  );
}
