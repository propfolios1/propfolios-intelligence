/**
 * Marks screens whose government registry data is simulated (the India
 * source adapters). 11px uppercase, gold ground, ink text, 4px radius.
 */
export function DemoBadge() {
  return (
    <span className="inline-flex h-5 items-center rounded-xs bg-gold-500 px-1.5 text-label font-medium tracking-[0.08em] text-ink-900 uppercase" title="MahaRERA, IGR, land record and Goa registry data on this screen is simulated. Rules and rates are real.">
      Demo mode
    </span>
  );
}
