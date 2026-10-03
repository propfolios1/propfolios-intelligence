export type Area = "analyst" | "client" | "admin" | "platform";

export interface NavItem {
  href: string;
  label: string;
  /** Single-key "g then …" shortcut. */
  key?: string;
  /** Hidden when the tenant has switched this feature off. */
  feature?: "assistant" | "clientPortal" | "marketTiming" | "crossBorder";
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

/** Navigation is set in type alone. No icons: every label is already clear. */
export const NAV: Record<Area, NavSection[]> = {
  analyst: [
    {
      items: [
        { href: "/analyst/dashboard", label: "Dashboard", key: "d" },
        { href: "/analyst/insights", label: "Insights", key: "i" },
        { href: "/analyst/mandates", label: "Mandates", key: "m" },
        { href: "/analyst/deals", label: "Deals", key: "e" },
        { href: "/analyst/commissions", label: "My commissions" },
        { href: "/analyst/memos", label: "Memos", key: "o" },
        { href: "/analyst/clients", label: "Clients", key: "c" },
      ],
    },
    {
      title: "Research",
      items: [
        { href: "/analyst/properties", label: "Properties", key: "p" },
        { href: "/analyst/developers", label: "Developers", key: "v" },
        { href: "/analyst/market", label: "Market", key: "k" },
        { href: "/analyst/federation", label: "Federation", key: "f" },
        { href: "/analyst/benchmarks", label: "Benchmarks", key: "b" },
        { href: "/analyst/assistant", label: "Assistant", key: "a", feature: "assistant" },
      ],
    },
    {
      title: "India",
      items: [
        { href: "/analyst/india", label: "Overview" },
        { href: "/analyst/india/mumbai", label: "Mumbai" },
        { href: "/analyst/india/goa", label: "Goa" },
        { href: "/analyst/india/tax-calculator", label: "Tax calculator" },
      ],
    },
    { title: "Account", items: [{ href: "/analyst/settings", label: "Settings", key: "s" }] },
  ],
  client: [
    {
      items: [
        { href: "/client/portfolio", label: "Portfolio", key: "p" },
        { href: "/client/deals", label: "Transactions", key: "t" },
        { href: "/client/insights", label: "Insights", key: "i" },
        { href: "/client/market-insights", label: "Market insights" },
        { href: "/client/opportunities", label: "Opportunities", key: "o" },
        { href: "/client/recommendations", label: "Recommendations", key: "r" },
      ],
    },
    {
      title: "Reporting",
      items: [
        { href: "/client/reports", label: "Reports" },
        { href: "/client/statements", label: "Statements" },
        { href: "/client/goals", label: "Goals", key: "g" },
        { href: "/client/private-banking", label: "Private banking" },
      ],
    },
    {
      title: "Workspace",
      items: [
        { href: "/client/documents", label: "Documents", key: "d" },
        { href: "/client/invoices", label: "Invoices" },
        { href: "/client/tax-documents", label: "Tax documents" },
        { href: "/client/india", label: "India" },
        { href: "/client/nri", label: "NRI plan" },
        { href: "/client/messages", label: "Messages", key: "m" },
        { href: "/client/assistant", label: "Assistant", key: "a", feature: "assistant" },
        { href: "/client/settings", label: "Settings", key: "s" },
      ],
    },
  ],
  admin: [
    {
      items: [
        { href: "/admin/dashboard", label: "Overview", key: "o" },
        { href: "/admin/users", label: "Users", key: "u" },
        { href: "/admin/branding", label: "Branding", key: "b" },
        { href: "/admin/billing", label: "Billing", key: "i" },
      ],
    },
    {
      title: "Revenue",
      items: [
        { href: "/admin/commissions", label: "Commissions", key: "c" },
        { href: "/admin/invoices", label: "Invoices", key: "v" },
      ],
    },
    {
      title: "Clients",
      items: [
        { href: "/admin/kyc", label: "KYC and AML", key: "k" },
        { href: "/admin/reports", label: "Reports", key: "r" },
        { href: "/admin/data-products", label: "Data products", key: "p" },
      ],
    },
    {
      title: "Governance",
      items: [
        { href: "/admin/audit", label: "Audit log", key: "l" },
        { href: "/admin/insights-config", label: "Intelligence", key: "t" },
        { href: "/admin/integrations", label: "Integrations", key: "n" },
        { href: "/admin/seed", label: "Demonstration data", key: "s" },
      ],
    },
  ],
  platform: [
    {
      items: [
        { href: "/platform/dashboard", label: "Dashboard", key: "d" },
        { href: "/platform/tenants", label: "Tenants", key: "t" },
        { href: "/platform/metrics", label: "Metrics", key: "m" },
        { href: "/platform/federation", label: "Federation", key: "f" },
        { href: "/platform/federation/dashboard", label: "Federation dashboard" },
        { href: "/platform/bi", label: "Business intelligence", key: "b" },
      ],
    },
  ],
};

export const SEGMENT_LABEL: Record<string, string> = {
  analyst: "Analyst",
  client: "Client",
  admin: "Admin",
  dashboard: "Dashboard",
  mandates: "Mandates",
  new: "Create Mandate",
  memos: "Memos",
  clients: "Clients",
  properties: "Properties",
  developers: "Developers",
  market: "Market",
  assistant: "Assistant",
  settings: "Settings",
  portfolio: "Portfolio",
  opportunities: "Opportunities",
  recommendations: "Recommendations",
  documents: "Documents",
  messages: "Messages",
  users: "Users",
  integrations: "Integrations",
  audit: "Audit log",
  seed: "Demonstration data",
  branding: "Branding",
  billing: "Billing",
  platform: "Platform",
  tenants: "Tenants",
  metrics: "Metrics",
  insights: "Insights",
  federation: "Federation",
  "insights-config": "Intelligence",
  india: "India",
  mumbai: "Mumbai",
  goa: "Goa",
  "tax-calculator": "Tax calculator",
  records: "Property file",
  nri: "NRI plan",
  deals: "Deals",
  commissions: "Commissions",
  structures: "Structures",
  invoices: "Invoices",
  kyc: "KYC",
  reports: "Reports",
  statements: "Statements",
  goals: "Goals",
  "tax-documents": "Tax documents",
  "private-banking": "Private banking",
  benchmarks: "Benchmarks",
  bi: "Business intelligence",
  "data-products": "Data products",
  "market-insights": "Market insights",
};

export const AREA_LABEL: Record<Area, string> = { analyst: "Analyst desk", client: "Client portal", admin: "Administration", platform: "Nakhla platform" };

export function navFor(area: Area, features?: Partial<Record<NonNullable<NavItem["feature"]>, boolean>>): NavSection[] {
  return NAV[area].map((s) => ({ ...s, items: s.items.filter((i) => !i.feature || features?.[i.feature] !== false) }));
}
