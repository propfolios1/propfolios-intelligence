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
    priceAed: 1_500,
    seats: 10,
    customDomain: false,
    summary: "For independent brokerages putting leads, listings and deals in one place.",
    features: ["Up to 10 agents", "CRM, listings and portal syndication", "AI lead response on email and WhatsApp", "Commission calculator and deal pipeline", "Client portal for buyers and landlords"],
  },
  {
    id: "professional",
    name: "Professional",
    priceAed: 8_000,
    seats: 50,
    customDomain: false,
    summary: "For growing brokerages with several teams and a marketing function.",
    features: ["Up to 50 agents", "Everything in Starter", "Marketing automation and social publishing", "Team performance and coaching dashboards", "Developer inventory sync with price-change alerts"],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceAed: 25_000,
    seats: null,
    customDomain: false,
    summary: "For multi-office brokerages and franchises with security and integration needs.",
    features: ["Unlimited agents", "Everything in Professional", "Single sign-on, SCIM and custom roles", "Choice of data region and signed audit export", "Dedicated onboarding and CRM migration"],
  },
  {
    id: "white_label",
    name: "White-label",
    priceAed: 50_000,
    seats: null,
    customDomain: true,
    summary: "Your platform, your domain. Nakhla runs underneath.",
    features: ["Everything in Enterprise", "Custom domain, for example app.yourbrokerage.com", "Agent app and client portal in your brand", "Sign-in pages and emails in your brand", "Contractual service levels"],
  },
];

export const planById = (id: string) => PLANS.find((p) => p.id === id) ?? PLANS[0]!;

export const VAT_RATE = 0.05;

/**
 * Modules whose use depends on the plan. Everything not listed here (CRM,
 * listings, portals, lead response, commission, compliance, client portal) is
 * on every plan: anti-money-laundering duties do not depend on firm size.
 */
export const PLAN_ORDER: PlanId[] = ["starter", "professional", "enterprise", "white_label"];
export const MODULE_MIN_PLAN = {
  marketing: "professional",
  team_analytics: "professional",
  developer_sync: "professional",
  sso: "enterprise",
  scim: "enterprise",
  custom_roles: "enterprise",
  audit_export: "enterprise",
  data_residency: "enterprise",
  custom_domain: "white_label",
} as const satisfies Record<string, PlanId>;
export type PlanModule = keyof typeof MODULE_MIN_PLAN;

export const MODULE_LABEL: Record<PlanModule, string> = {
  marketing: "Marketing automation",
  team_analytics: "Team performance analytics",
  developer_sync: "Developer inventory sync",
  sso: "Single sign-on",
  scim: "SCIM provisioning",
  custom_roles: "Custom roles",
  audit_export: "Audit export",
  data_residency: "Choice of data region",
  custom_domain: "Custom domain",
};

export function planIncludes(plan: string, module: PlanModule) {
  const have = PLAN_ORDER.indexOf(plan as PlanId);
  return have >= 0 && have >= PLAN_ORDER.indexOf(MODULE_MIN_PLAN[module]);
}
