import { Network } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FederationStatsData {
  deals: number;
  advisories: number;
  baselines?: number;
  lastRunAt?: string | null;
}

/** "Learnings from N deals across M advisories": the federated intelligence behind every recommendation. */
export function FederationStats({ stats, variant = "inline", className }: { stats: FederationStatsData; variant?: "inline" | "panel"; className?: string }) {
  const line = (
    <>
      Learnings from <span className="num text-ink-900">{stats.deals.toLocaleString("en-US")}</span> {stats.deals === 1 ? "deal" : "deals"} across <span className="num text-ink-900">{stats.advisories.toLocaleString("en-US")}</span> {stats.advisories === 1 ? "advisory" : "advisories"}
    </>
  );
  if (variant === "inline") {
    return (
      <p className={cn("inline-flex items-center gap-2 text-small text-ink-500", className)}>
        <Network className="size-3.5 stroke-[1.5] text-gold-600" aria-hidden />
        <span>{line}</span>
      </p>
    );
  }
  return (
    <div className={cn("rounded-md border border-ink-200 bg-surface p-5 shadow-card", className)}>
      <div className="eyebrow flex items-center gap-2">
        <Network className="size-3.5 stroke-[1.5] text-gold-600" aria-hidden />
        Federated intelligence
      </div>
      <p className="mt-3 text-body text-ink-700">{line}.</p>
      <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-ink-200 pt-4">
        <div>
          <dt className="text-axis uppercase tracking-[0.12em] text-ink-500">Deals</dt>
          <dd className="num mt-1 text-card text-navy-900">{stats.deals}</dd>
        </div>
        <div>
          <dt className="text-axis uppercase tracking-[0.12em] text-ink-500">Advisories</dt>
          <dd className="num mt-1 text-card text-navy-900">{stats.advisories}</dd>
        </div>
        <div>
          <dt className="text-axis uppercase tracking-[0.12em] text-ink-500">Baselines</dt>
          <dd className="num mt-1 text-card text-navy-900">{stats.baselines ?? 0}</dd>
        </div>
      </dl>
      <p className="mt-4 text-small text-ink-500">Anonymised: property, developer and firm identities are salted hashes, and a baseline is published only when it covers at least three deals from two firms.</p>
    </div>
  );
}
