export type Area = "analyst" | "client" | "admin";

export interface NavItem {
  href: string;
  label: string;
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
        { href: "/analyst/dashboard", label: "Today" },
        { href: "/analyst/mandates", label: "Mandates" },
        { href: "/analyst/memos", label: "Memos" },
      ],
    },
    {
      title: "Research",
      items: [
        { href: "/analyst/properties", label: "Properties" },
        { href: "/analyst/developers", label: "Developer risk" },
        { href: "/analyst/market", label: "Market" },
      ],
    },
  ],
  client: [
    {
      items: [
        { href: "/client/portfolio", label: "Portfolio" },
        { href: "/client/opportunities", label: "Opportunities" },
        { href: "/client/recommendations", label: "Recommendations" },
      ],
    },
    {
      title: "Workspace",
      items: [
        { href: "/client/documents", label: "Documents" },
        { href: "/client/assistant", label: "Ask" },
      ],
    },
  ],
  admin: [
    {
      items: [
        { href: "/admin/users", label: "Users" },
        { href: "/admin/integrations", label: "Integrations" },
        { href: "/admin/audit", label: "Audit log" },
        { href: "/admin/seed", label: "Data" },
      ],
    },
  ],
};

export const SEGMENT_LABEL: Record<string, string> = {
  analyst: "Analyst",
  client: "Client",
  admin: "Admin",
  dashboard: "Today",
  mandates: "Mandates",
  memos: "Memos",
  properties: "Properties",
  developers: "Developer risk",
  market: "Market",
  portfolio: "Portfolio",
  opportunities: "Opportunities",
  recommendations: "Recommendations",
  documents: "Documents",
  assistant: "Ask",
  users: "Users",
  integrations: "Integrations",
  audit: "Audit log",
  seed: "Data",
};

export const AREA_LABEL: Record<Area, string> = { analyst: "Analyst desk", client: "Client portal", admin: "Administration" };
