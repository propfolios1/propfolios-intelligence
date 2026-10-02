/** Commercial plans. Seat limits and white-label rights are enforced in code. */

export type PlanId = "starter" | "professional" | "enterprise" | "white_label";

export interface Plan {
  id: PlanId;
  name: string;
  priceAed: number;
  /** Staff seats (administrators and analysts). Clients are not counted. null = unlimited. */
  seats: number | null;
  customDomain: boolean;
  summary: string;
  features: string[];
}

export const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    priceAed: 3_000,
    seats: 5,
    customDomain: false,
    summary: "For boutique advisories building an institutional process.",
    features: ["5 staff seats", "Unlimited clients and client portal", "Twelve research and underwriting agents", "Allocation Memos with PDF export", "Daily portfolio monitoring"],
  },
  {
    id: "professional",
    name: "Professional",
    priceAed: 8_000,
    seats: 20,
    customDomain: false,
    summary: "For established firms running several mandates a week.",
    features: ["20 staff seats", "Everything in Starter", "Firm branding: logo, colours and memo house style", "Market timing and cross-border arbitrage agents", "Audit log export"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceAed: 25_000,
    seats: null,
    customDomain: false,
    summary: "For family offices and multi-desk advisories.",
    features: ["Unlimited staff seats", "Everything in Professional", "Priority agent capacity", "Dedicated onboarding and data migration", "Quarterly model and prompt review"],
  },
  {
    id: "white_label",
    name: "White-label",
    priceAed: 50_000,
    seats: null,
    customDomain: true,
    summary: "Your platform, your domain. Nakhla runs underneath.",
    features: ["Everything in Enterprise", "Custom domain, for example intelligence.yourfirm.ae", "Client portal fully in your brand", "Sign-in pages in your brand", "Contractual service levels"],
  },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id) ?? PLANS[0]!;

export const VAT_RATE = 0.05;
