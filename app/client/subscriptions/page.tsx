import { EmptyState } from "@/components/composites/empty-state";
import { PageHeader } from "@/components/composites/page-header";
import { NewSubscription, SubscriptionCard } from "@/components/market-intel/subscriptions";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import type { SubscriptionFilters } from "@/db/schema-production";
import { requireRole } from "@/lib/auth";
import { MAX_SUBSCRIPTIONS, areaOptions, listSubscriptions } from "@/lib/market-intel/service";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Market subscriptions" };
export const dynamic = "force-dynamic";

function summary(f: SubscriptionFilters) {
  const where = f.areas.length ? f.areas.slice(0, 3).join(", ") + (f.areas.length > 3 ? ` and ${f.areas.length - 3} more` : "") : f.markets.map((m) => MARKETS[m as MarketCode]?.name ?? m).join(", ");
  const beds = f.bedrooms.length ? `${f.bedrooms.map((b) => (b === 0 ? "studio" : b === 5 ? "5+" : b)).join(", ")} bed` : "";
  const types = f.propertyTypes.length ? f.propertyTypes.join(" or ").toLowerCase() : "homes";
  const budget = f.budgetMin !== null || f.budgetMax !== null ? `${f.budgetMin !== null ? formatMoney(f.budgetMin, f.currency) : "any"} to ${f.budgetMax !== null ? formatMoney(f.budgetMax, f.currency) : "any"}` : "any budget";
  return `${[beds, types].filter(Boolean).join(" ")} ${f.purpose === "rent" ? "to rent" : "for sale"} in ${where}; ${budget}.`;
}

export default async function Subscriptions() {
  const user = await requireRole(["tenant_admin", "analyst", "client"]);
  const db = await getDb();
  const [subs, opts] = await Promise.all([user.clientId ? listSubscriptions(db, user.tenantId, user.clientId) : [], areaOptions(db, user.tenantId)]);
  const options = { markets: opts.markets.filter((m) => m in MARKETS).map((m) => ({ code: m, name: MARKETS[m as MarketCode].name, flag: MARKETS[m as MarketCode].flag, currency: MARKETS[m as MarketCode].currency })), areas: opts.areas, propertyTypes: opts.propertyTypes };
  const rows = subs.map((x) => ({ ...x, lastSentAt: x.lastSentAt?.toISOString() ?? null, nextDueAt: x.nextDueAt.toISOString() }));
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Research"
        title="Market subscriptions"
        subtitle="Follow the areas and homes you are interested in. Each brief covers prices and activity, new listings that match, and developer releases and price changes within your budget."
      />
      {subs.length < MAX_SUBSCRIPTIONS && (
        <div className="mt-8">
          <NewSubscription options={options} />
        </div>
      )}
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {rows.map((x) => (
          <SubscriptionCard key={x.id} sub={x} options={options} summary={summary(x.filters)} />
        ))}
      </div>
      {!subs.length && <EmptyState glyph="opportunities" headline="You are not following any markets" note="Choose the markets, areas, property types and budget you care about. Your first brief is written as soon as you subscribe, then arrives on the schedule you choose." />}
      <p className="mt-8 max-w-[70ch] text-[12px] text-ink-500">
        Briefs are compiled from your advisers&rsquo; monthly market statistics, the firm&rsquo;s live listings and the developer price lists it receives. They are information, not advice; speak to your adviser before acting on them. You can follow up to {MAX_SUBSCRIPTIONS} markets.
      </p>
    </PageContainer>
  );
}
