export type Area = "analyst" | "client" | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV: Record<Area, NavSection[]> = {
  analyst: [
    {
      items: [
        { href: "/analyst/dashboard", label: "Dashboard", icon: "LayoutGrid" },
        { href: "/analyst/mandates", label: "Mandates", icon: "Briefcase" },
        { href: "/analyst/memos", label: "Memos", icon: "FileText" },
      ],
    },
    {
      title: "Research",
      items: [
        { href: "/analyst/properties", label: "Properties", icon: "Building2" },
        { href: "/analyst/developers", label: "Developer Risk", icon: "ShieldAlert" },
        { href: "/analyst/market", label: "Market", icon: "LineChart" },
      ],
    },
  ],
  client: [
    {
      items: [
        { href: "/client/portfolio", label: "Portfolio", icon: "PieChart" },
        { href: "/client/opportunities", label: "Opportunities", icon: "Compass" },
        { href: "/client/recommendations", label: "Recommendations", icon: "Sparkles" },
      ],
    },
    {
      title: "Workspace",
      items: [
        { href: "/client/documents", label: "Documents", icon: "Folder" },
        { href: "/client/assistant", label: "Assistant", icon: "MessageSquare" },
      ],
    },
  ],
  admin: [
    {
      items: [
        { href: "/admin/users", label: "Users", icon: "Users" },
        { href: "/admin/integrations", label: "Integrations", icon: "Plug" },
        { href: "/admin/audit", label: "Audit Log", icon: "ScrollText" },
        { href: "/admin/seed", label: "Data & Seed", icon: "Database" },
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
  memos: "Memos",
  properties: "Properties",
  developers: "Developer Risk",
  market: "Market",
  portfolio: "Portfolio",
  opportunities: "Opportunities",
  recommendations: "Recommendations",
  documents: "Documents",
  assistant: "Assistant",
  users: "Users",
  integrations: "Integrations",
  audit: "Audit Log",
  seed: "Data & Seed",
};
