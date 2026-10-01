export type Area = "analyst" | "client" | "admin";

export interface NavItem {
  href: string;
  label: string;
  /** Single-key "g then …" shortcut. */
  key?: string;
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
        { href: "/analyst/mandates", label: "Mandates", key: "m" },
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
        { href: "/analyst/assistant", label: "Assistant", key: "a" },
      ],
    },
    { title: "Account", items: [{ href: "/analyst/settings", label: "Settings", key: "s" }] },
  ],
  client: [
    {
      items: [
        { href: "/client/portfolio", label: "Portfolio", key: "p" },
        { href: "/client/opportunities", label: "Opportunities", key: "o" },
        { href: "/client/recommendations", label: "Recommendations", key: "r" },
      ],
    },
    {
      title: "Workspace",
      items: [
        { href: "/client/documents", label: "Documents", key: "d" },
        { href: "/client/messages", label: "Messages", key: "m" },
        { href: "/client/assistant", label: "Assistant", key: "a" },
        { href: "/client/settings", label: "Settings", key: "s" },
      ],
    },
  ],
  admin: [
    {
      items: [
        { href: "/admin/users", label: "Users", key: "u" },
        { href: "/admin/integrations", label: "Integrations", key: "i" },
        { href: "/admin/audit", label: "Audit log", key: "l" },
        { href: "/admin/seed", label: "Seed data", key: "s" },
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
  seed: "Seed data",
};

export const AREA_LABEL: Record<Area, string> = { analyst: "Analyst desk", client: "Client portal", admin: "Administration" };
