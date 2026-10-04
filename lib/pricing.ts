import { PLANS, planIncludes, type PlanModule } from "./plans";

/**
 * The public comparison table. Rows tied to a module are derived from the
 * plan gates the API enforces, so the table cannot promise what the product
 * refuses, or charge for what it gives away.
 */
export type Cell = string | boolean;
const ROWS: { label: string; module?: PlanModule; all?: true }[] = [
  { label: "CRM, listings and portal syndication", all: true },
  { label: "AI lead response on email and WhatsApp, under a minute", all: true },
  { label: "Commission calculator, splits and invoices", all: true },
  { label: "Compliance centre: KYC, screening, goAML and FINnet reports", all: true },
  { label: "Client portal with market briefs", all: true },
  { label: "Marketing automation and social publishing", module: "marketing" },
  { label: "Team performance and coaching dashboards", module: "team_analytics" },
  { label: "Developer inventory sync", module: "developer_sync" },
  { label: "Single sign-on, SCIM and custom roles", module: "sso" },
  { label: "Choice of data region and signed audit export", module: "data_residency" },
  { label: "Custom domain and agent app in your brand", module: "custom_domain" },
];

export function comparison(): [string, Cell[]][] {
  return [["Agents", PLANS.map((p) => (p.seats === null ? "Unlimited" : String(p.seats)))], ...ROWS.map((r) => [r.label, PLANS.map((p) => (r.all ? true : planIncludes(p.id, r.module!)))] as [string, Cell[]])];
}

export const ADDONS: { name: string; detail: string; aed: number | null; unit: string; from?: boolean; included?: string }[] = [
  { name: "Additional agents", detail: "Beyond the plan's agent allowance, on Starter and Professional.", aed: 150, unit: "per agent per month" },
  { name: "Additional WhatsApp number", detail: "A second WhatsApp Business number, for a team or an office. Meta's conversation charges pass through at cost.", aed: 400, unit: "per number per month" },
  { name: "Additional branded website", detail: "A further website on its own domain, for a project launch or a second brand.", aed: 750, unit: "per site per month" },
  { name: "Priority AI capacity", detail: "Reserved model throughput for peak launch weeks.", aed: 2_500, unit: "per month", included: "Included on Enterprise" },
  { name: "Assisted migration", detail: "We move leads, listings, deals and documents from your current CRM and check every record.", aed: 7_500, unit: "one-off", from: true, included: "Included on Enterprise" },
  { name: "Dedicated UAE deployment", detail: "In-country hosting on a UAE cloud region for firms whose clients require it.", aed: null, unit: "quoted", included: "Enterprise only" },
];
