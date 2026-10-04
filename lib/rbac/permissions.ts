/**
 * Role-based access control for the vertical OS. Eleven access roles refine
 * the four base roles (platform_admin, tenant_admin, analyst, client) that
 * row-level security and Clerk organisations use. A permission check needs
 * the access role; the base role still gates areas of the app.
 */

export const ACCESS_ROLES = [
  "platform_admin",
  "platform_support",
  "tenant_owner",
  "tenant_admin",
  "senior_analyst",
  "analyst",
  "junior_analyst",
  "compliance_officer",
  "client_principal",
  "client_delegate",
  "client_viewer",
] as const;
export type AccessRole = (typeof ACCESS_ROLES)[number];

export const ROLE_LABEL: Record<AccessRole, string> = {
  platform_admin: "Platform administrator",
  platform_support: "Platform support",
  tenant_owner: "Firm owner",
  tenant_admin: "Firm administrator",
  senior_analyst: "Senior analyst",
  analyst: "Analyst",
  junior_analyst: "Junior analyst",
  compliance_officer: "Compliance officer",
  client_principal: "Client principal",
  client_delegate: "Client delegate",
  client_viewer: "Client viewer",
};

export const BASE_ROLE: Record<AccessRole, "platform_admin" | "tenant_admin" | "analyst" | "client"> = {
  platform_admin: "platform_admin",
  platform_support: "platform_admin",
  tenant_owner: "tenant_admin",
  tenant_admin: "tenant_admin",
  senior_analyst: "analyst",
  analyst: "analyst",
  junior_analyst: "analyst",
  compliance_officer: "tenant_admin",
  client_principal: "client",
  client_delegate: "client",
  client_viewer: "client",
};

/** Default access role for a base role when none is assigned. */
export const DEFAULT_ACCESS: Record<"platform_admin" | "tenant_admin" | "analyst" | "client", AccessRole> = { platform_admin: "platform_admin", tenant_admin: "tenant_admin", analyst: "analyst", client: "client_principal" };

export const PERMISSIONS = {
  "platform:tenants": "Manage firms on the platform",
  "platform:bi": "Run benchmarks and package data products",
  "platform:support_read": "Read a firm's records for support",
  "firm:billing": "Plans, seats and billing",
  "firm:users": "Invite users and assign roles",
  "firm:settings": "Branding, integrations and intelligence settings",
  "firm:ai_control": "Switch agents on and off; set the AI budget",
  "mandates:create": "Create mandates",
  "mandates:run": "Run the agent pipeline",
  "mandates:approve": "Approve memos for delivery",
  "deals:manage": "Open and run deals",
  "deals:close": "Close deals and start commission",
  "contracts:send": "Send contracts for signature",
  "commissions:view_own": "See own commission shares",
  "commissions:view_all": "See all commissions",
  "commissions:structures": "Edit commission structures",
  "invoices:manage": "Issue invoices and record payments",
  "kyc:review": "Review KYC files",
  "kyc:decide": "Verify or reject KYC",
  "aml:disposition": "Disposition screening alerts",
  "compliance:requests": "Handle data export and deletion requests",
  "audit:read": "Read the audit log",
  "automations:manage": "Create and edit automations",
  "reports:generate": "Generate client reports and statements",
  "clients:read": "Read client records",
  "clients:write": "Edit client records",
  "leads:manage": "Capture, work and convert leads",
  "listings:manage": "Create listings and syndicate them to portals",
  "marketing:send": "Send marketing campaigns",
  "rentals:manage": "Manage tenancies, rent and maintenance",
  "team:manage": "Offices, targets and recruiting",
  "portal:own": "Own portfolio, documents and reports",
  "portal:sign": "Sign documents",
  "portal:instruct": "Instruct the advisers (approve transactions)",
  "portal:messages": "Message the advisers",
} as const;
export type Permission = keyof typeof PERMISSIONS;

const STAFF_READ: Permission[] = ["clients:read", "commissions:view_own", "reports:generate"];
const ANALYST: Permission[] = [...STAFF_READ, "mandates:create", "mandates:run", "deals:manage", "contracts:send", "clients:write", "kyc:review", "leads:manage", "listings:manage", "rentals:manage"];
const SENIOR: Permission[] = [...ANALYST, "mandates:approve", "deals:close", "commissions:view_all", "automations:manage", "audit:read", "marketing:send"];
const FIRM_ADMIN: Permission[] = [...SENIOR, "firm:users", "firm:settings", "firm:ai_control", "commissions:structures", "invoices:manage", "kyc:decide", "aml:disposition", "compliance:requests", "team:manage"];

export const MATRIX: Record<AccessRole, Permission[]> = {
  platform_admin: Object.keys(PERMISSIONS) as Permission[],
  platform_support: ["platform:support_read", "audit:read", "clients:read"],
  tenant_owner: [...FIRM_ADMIN, "firm:billing"],
  tenant_admin: FIRM_ADMIN,
  senior_analyst: SENIOR,
  analyst: ANALYST,
  junior_analyst: [...STAFF_READ, "mandates:create", "mandates:run", "kyc:review", "leads:manage"],
  compliance_officer: ["clients:read", "kyc:review", "kyc:decide", "aml:disposition", "compliance:requests", "audit:read", "commissions:view_all"],
  client_principal: ["portal:own", "portal:sign", "portal:instruct", "portal:messages"],
  client_delegate: ["portal:own", "portal:sign", "portal:messages"],
  client_viewer: ["portal:own"],
};

export function can(role: AccessRole | null | undefined, permission: Permission) {
  return !!role && MATRIX[role].includes(permission);
}

/** Every permission a role has that another lacks; used by the permission suggester and the matrix page. */
export function diff(a: AccessRole, b: AccessRole) {
  return MATRIX[a].filter((p) => !MATRIX[b].includes(p));
}
