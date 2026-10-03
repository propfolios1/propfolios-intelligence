import { Network } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { FederationBaselineData } from "@/db/schema";
import { cn } from "@/lib/utils";

export interface BaselineView {
  label: string;
  deals: number;
  advisories: number;
  data: FederationBaselineData;
  computedAt: string;
}

const ROWS: { key: keyof FederationBaselineData["medians"]; label: string }[] = [
  { key: "grossYield", label: "Gross yield" },
  { key: "rentGrowth", label: "Rent growth" },
  { key: "vacancy", label: "Vacancy" },
  { key: "capitalGrowth", label: "Capital growth" },
  { key: "opexRatio", label: "Operating costs" },
  { key: "discountRate", label: "Hurdle" },
];

/** This deal's assumptions against the federated median for its segment. */
export function FederatedBaselineCard({ baseline, assumptions }: { baseline: BaselineView | null; assumptions: Record<string, number> }) {
  return (
    <Card>
      <CardHeader eyebrow="Layer 6 · federated baseline" title="Calibration against comparable deals" />
      <CardContent>
        {baseline ? (
          <>
            <p className="flex items-center gap-2 text-small text-ink-500">
              <Network className="size-3.5 stroke-[1.5] text-gold-600" aria-hidden />
              {baseline.label}: <span className="num text-ink-900">{baseline.deals}</span> completed deals across <span className="num text-ink-900">{baseline.advisories}</span> advisories.
            </p>
            <table className="mt-4 w-full text-small">
              <thead>
                <tr className="text-left text-axis uppercase tracking-[0.12em] text-ink-500">
                  <th className="py-2 font-normal">Assumption</th>
                  <th className="py-2 text-right font-normal">This deal</th>
                  <th className="py-2 text-right font-normal">Federation median</th>
                  <th className="py-2 text-right font-normal">Gap</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline border-t border-hairline">
                {ROWS.map((r) => {
                  const mine = assumptions[r.key] ?? 0;
                  const fed = baseline.data.medians[r.key];
                  const gap = (mine - fed) * 100;
                  const material = Math.abs(gap) > 1 || (r.key === "vacancy" && fed > 0 && Math.abs(mine / fed - 1) > 0.2);
                  return (
                    <tr key={r.key}>
                      <td className="py-2 text-ink-700">{r.label}</td>
                      <td className="num py-2 text-right text-ink-900">{(mine * 100).toFixed(1)}%</td>
                      <td className="num py-2 text-right text-ink-700">{(fed * 100).toFixed(1)}%</td>
                      <td className={cn("num py-2 text-right", material ? "font-medium text-ink-900" : "text-ink-500")}>
                        {gap >= 0 ? "+" : ""}
                        {gap.toFixed(1)} pts
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-4 text-small text-ink-500">
              Federated P50 IRR interquartile range <span className="num">{baseline.data.irr.p25}%</span> to <span className="num">{baseline.data.irr.p75}%</span>.
              {baseline.data.topRisks.length > 0 && <> Most frequent serious findings: {baseline.data.topRisks.map((t) => `${t.category} (${Math.round(t.share * 100)}%)`).join(", ")}.</>}
            </p>
          </>
        ) : (
          <p className="text-small text-ink-500">No federated baseline is published for this segment yet. A baseline appears once at least three deals from two advisories have been contributed.</p>
        )}
      </CardContent>
    </Card>
  );
}
