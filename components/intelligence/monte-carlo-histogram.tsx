import { BarSeries } from "@/components/charts/series";

export interface DistributionData {
  iterations: number;
  histogram: { bucket: string; count: number }[];
  mean: number;
  probBelowHurdle: number;
}

/** IRR distribution of the simulated paths, with the share below the hurdle stated beneath. */
export function MonteCarloHistogram({ distribution, hurdlePct, height = 220 }: { distribution: DistributionData; hurdlePct: number; height?: number }) {
  return (
    <figure>
      <BarSeries data={distribution.histogram} x="bucket" y="count" name="Paths" height={height} format="number" />
      <figcaption className="mt-3 text-small text-ink-500">
        <span className="num">{distribution.iterations.toLocaleString("en-US")}</span> paths. <span className="num">{(distribution.probBelowHurdle * 100).toFixed(0)}%</span> fall below the <span className="num">{hurdlePct.toFixed(1)}%</span> hurdle; mean IRR <span className="num">{(distribution.mean * 100).toFixed(1)}%</span>.
      </figcaption>
    </figure>
  );
}
