import { PLANS } from "@/lib/plans";

export const DEFAULT_ASSUMPTIONS = { adminHours: 12, reduction: 60, reinvest: 50, sellingHours: 40, replaced: 60 };

export function planFor(seats: number) {
  return seats <= 5 ? PLANS.find((p) => p.id === "starter")! : seats <= 20 ? PLANS.find((p) => p.id === "professional")! : PLANS.find((p) => p.id === "enterprise")!;
}

/** The calculator's arithmetic, kept pure so the page shows exactly what it computes. */
export function roi(i: { agents: number; deals: number; commission: number; tools: number; aedPer: number } & typeof DEFAULT_ASSUMPTIONS) {
  const plan = planFor(i.agents);
  const hoursSaved = i.agents * i.deals * i.adminHours * (i.reduction / 100);
  const extraDeals = (hoursSaved * 12 * (i.reinvest / 100)) / i.sellingHours;
  const extraRevenue = extraDeals * i.commission;
  const toolSavings = i.tools * 12 * (i.replaced / 100);
  const subscription = (plan.priceAed * 12) / i.aedPer;
  const benefit = extraRevenue + toolSavings;
  const net = benefit - subscription;
  const paybackMonths = benefit > 0 ? subscription / (benefit / 12) : null;
  return { plan, hoursSaved, extraDeals, extraRevenue, toolSavings, subscription, net, paybackMonths };
}
