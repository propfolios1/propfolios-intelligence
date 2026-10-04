import type { PlanId } from "./plans";
import { PERMISSIONS } from "./rbac/permissions";

const GRANTABLE_COUNT = Object.keys(PERMISSIONS).filter((p) => !p.startsWith("platform:")).length;

/** The four firm sizes the public site speaks to, each with its recommended plan. */
export type Segment = {
  slug: "small-brokerages" | "mid-size-brokerages" | "enterprise-brokerages" | "franchises";
  name: string;
  size: string;
  menu: string;
  headline: string;
  sub: string;
  plan: PlanId;
  pains: { title: string; body: string }[];
  flow: { time: string; title: string; body: string; module: string }[];
  included: { title: string; body: string; href: string }[];
  note?: string;
};

export const SEGMENTS: Segment[] = [
  {
    slug: "small-brokerages",
    name: "Small brokerages",
    size: "1 to 10 agents",
    menu: "Independent firms that need every lead answered",
    headline: "Answer every lead in seconds, even when the office is closed.",
    sub: "For founder-led brokerages where the same few people list, show, negotiate and chase commission. Nakhla does the first reply, the retyping and the arithmetic, so your agents spend their day with buyers.",
    plan: "starter",
    pains: [
      { title: "Leads go cold overnight", body: "Portal enquiries that arrive at 11 at night are answered at 10 the next morning, after the buyer has called three other agents." },
      { title: "The same listing, typed five times", body: "Every portal wants the listing in its own format, with its own photo rules and its own permit field." },
      { title: "Commission lives in a spreadsheet", body: "Splits, referral fees and VAT are worked out by hand at the end of the month, and disputes start there." },
    ],
    flow: [
      { time: "23:10", title: "A buyer enquires on Bayut", body: "The lead arrives in Nakhla with the listing attached and is assigned to the agent on rotation.", module: "Leads" },
      { time: "23:10", title: "The assistant replies on WhatsApp", body: "It answers in the firm's voice, asks budget, timeline and financing, and offers two viewing slots from the agent's calendar.", module: "Lead response" },
      { time: "09:00", title: "The agent opens a qualified lead", body: "Budget, areas and a booked viewing are already on the record, with the full conversation.", module: "CRM" },
      { time: "Day 21", title: "The deal closes", body: "Commission is split between agent, team and referrer to the fil, and the invoice carries 5% VAT.", module: "Commission" },
    ],
    included: [
      { title: "CRM and pipeline", body: "Leads, viewings, offers and deals in one place, scored and assigned automatically.", href: "/docs/getting-started" },
      { title: "Portal syndication", body: "Publish once to Bayut, Property Finder and Dubizzle; enquiries come back as leads.", href: "/docs/portals/uae" },
      { title: "AI lead response", body: "Replies in seconds on email and WhatsApp, qualifies and books viewings, hands over when it should.", href: "/faq" },
      { title: "Commission calculator", body: "Flat, tiered, team and referral structures, exact to the fil, with VAT invoices.", href: "/docs/getting-started" },
      { title: "Compliance centre", body: "Screening, KYC files and goAML reports, because AML duties do not depend on firm size.", href: "/docs/compliance" },
      { title: "Move in a day", body: "Import from Follow Up Boss, HubSpot, Zoho or a spreadsheet, with a dry run first.", href: "/docs/migration" },
    ],
  },
  {
    slug: "mid-size-brokerages",
    name: "Mid-size brokerages",
    size: "10 to 50 agents",
    menu: "Growing firms with several teams",
    headline: "See every team's pipeline, and coach before the quarter is lost.",
    sub: "For brokerages with team leaders, a marketing function and more leads than any one person can watch. Nakhla shows who is converting, automates the follow-up and keeps developer stock current.",
    plan: "professional",
    pains: [
      { title: "Follow-up depends on the agent", body: "Some teams call back in minutes, others in days, and nobody sees it until the month's numbers arrive." },
      { title: "Marketing is a manual job", body: "New listings, price reductions and nurture emails are sent when someone remembers, to whoever is on a spreadsheet." },
      { title: "Off-plan stock is out of date", body: "Developer price lists arrive by email and are stale by the time an agent quotes them to a buyer." },
    ],
    flow: [
      { time: "Monday", title: "The sales director opens the team view", body: "Response times, viewings, offers and conversion by agent and team, against the firm's medians.", module: "Team analytics" },
      { time: "Monday", title: "Coaching flags are raised", body: "An agent whose first-response time has doubled is flagged with the leads affected, before it costs a deal.", module: "Coaching" },
      { time: "Tuesday", title: "A developer cuts prices", body: "The sync picks up the new price list, marks the reductions, and matches the units to buyers with the right budget.", module: "Developer sync" },
      { time: "Tuesday", title: "Matched buyers hear first", body: "A sequence sends the reduced units to consenting leads by email and WhatsApp, and posts them to the firm's social accounts.", module: "Marketing" },
    ],
    included: [
      { title: "Everything in Starter", body: "CRM, portals, lead response, commission and compliance for up to 50 agents.", href: "/pricing" },
      { title: "Team performance", body: "Leaderboards, medians and coaching flags by agent, team and office.", href: "/docs/getting-started/roles" },
      { title: "Marketing automation", body: "Audiences, email and WhatsApp sequences, listing promotion and scheduled social posts.", href: "/faq" },
      { title: "Developer inventory sync", body: "Price lists and feeds from developers' broker programmes, including Emaar, DAMAC, Aldar, Sobha and Lodha, with change alerts.", href: "/docs/portals" },
      { title: "Contract templates", body: "Forms modelled on the official Form A, B and F, filled from the deal and sent for signature.", href: "/docs/compliance" },
      { title: "Client portal and briefs", body: "Buyers and landlords follow their deals and receive market briefs on the areas they care about.", href: "/faq" },
    ],
  },
  {
    slug: "enterprise-brokerages",
    name: "Enterprise brokerages",
    size: "50 agents and more",
    menu: "Multi-office firms with IT and security reviews",
    headline: "The brokerage platform your IT and compliance teams can sign off.",
    sub: "For firms with several offices, a security questionnaire for every vendor and systems that must talk to each other. Nakhla adds single sign-on, provisioning, custom roles, a choice of data region and a full API.",
    plan: "enterprise",
    pains: [
      { title: "Every vendor is a security review", body: "IT needs single sign-on, leaver processes, audit trails and to know where the data sits before anyone can log in." },
      { title: "Roles do not fit the org chart", body: "A leasing desk lead, a compliance analyst and an external auditor each need a different slice of the system." },
      { title: "Data is trapped", body: "Finance, BI and the website all need the same leads and deals, and nightly CSV exports break." },
    ],
    flow: [
      { time: "Week 1", title: "IT connects the identity provider", body: "Okta or Entra ID signs staff in; SCIM creates accounts and removes leavers the moment HR does.", module: "SSO and SCIM" },
      { time: "Week 1", title: "Roles mirror the organisation", body: `Custom roles are composed from the ${GRANTABLE_COUNT} grantable permissions and mapped to identity provider groups.`, module: "Custom roles" },
      { time: "Week 2", title: "Systems are connected", body: "Webhooks notify the ERP when deals close; BI reads through the API; assistants use the MCP server.", module: "API" },
      { time: "Every quarter", title: "Audit asks for the trail", body: "A signed export of every action, by people and AI agents, goes straight into the SIEM.", module: "Audit export" },
    ],
    included: [
      { title: "Single sign-on and SCIM", body: "SAML 2.0 or OIDC with verified domains, enforcement and automatic provisioning.", href: "/docs/enterprise/sso" },
      { title: "Custom roles", body: "Compose roles from the permission catalogue and map them to identity provider groups.", href: "/docs/getting-started/roles" },
      { title: "API, webhooks and MCP", body: "Scoped keys with rate limits and usage, signed webhooks, and an MCP server for assistants.", href: "/docs/api" },
      { title: "Choice of data region", body: "Mumbai, Frankfurt, London, Singapore, Sydney or North Virginia, or a dedicated UAE deployment.", href: "/security" },
      { title: "Signed audit export", body: "CSV or JSON Lines with a SHA-256 digest and signature, ready for a SIEM.", href: "/docs/api/authentication" },
      { title: "Assisted migration", body: "Our team moves your CRM and checks the records with you.", href: "/docs/migration" },
    ],
  },
  {
    slug: "franchises",
    name: "Franchises and networks",
    size: "Networks of offices",
    menu: "Brands with offices or franchisees",
    headline: "One brand, every office on the same system.",
    sub: "For franchise networks and multi-brand groups. Every office works its leads and deals on the same system, the network sees every agent's pipeline, and the platform carries your name.",
    plan: "white_label",
    pains: [
      { title: "Every office runs its own tools", body: "New franchisees arrive with their own CRM and spreadsheets, and network reporting is assembled by hand." },
      { title: "The brand stops at the website", body: "Clients see the franchise brand on the sign, then a different vendor's name in every email and app." },
      { title: "Onboarding an office takes months", body: "Data, portals, commission rules and training are rebuilt for each new location." },
    ],
    flow: [
      { time: "Day 1", title: "A new office joins the network", body: "Its leads and listings are imported with the migration tool, and its agents are invited into the office.", module: "Offices" },
      { time: "Day 2", title: "Office arrangements are set", body: "Commission structures for the office's splits start from the network's presets, and each agent gets monthly targets.", module: "Commission" },
      { time: "Every day", title: "Clients see one brand", body: "The website, client portal, agent app and emails carry the network's name and domain.", module: "White-label" },
      { time: "Month end", title: "The network reviews performance", body: "Leaderboards, targets and coaching flags across every agent, from the same records each office works in.", module: "Team analytics" },
    ],
    included: [
      { title: "Your domain and app", body: "app.yourbrand.com, the agent app and the client portal in the network's brand.", href: "/pricing" },
      { title: "Offices and targets", body: "Offices with their agents, licences and onboarding; monthly targets for every agent.", href: "/docs/getting-started/roles" },
      { title: "Network roles", body: "Custom roles for office principals, network managers and the compliance function.", href: "/docs/getting-started/roles" },
      { title: "Repeatable onboarding", body: "The same migration tool and portal set-up for every new office.", href: "/docs/migration" },
      { title: "Compliance across the network", body: "One screening and KYC standard, with reports prepared for each office's compliance officer.", href: "/docs/compliance" },
      { title: "Single sign-on", body: "Staff across every office sign in with the network's identity provider.", href: "/docs/enterprise/sso" },
    ],
    note: "Offices share one workspace. Franchisees who must keep client data separate from the network run their own workspace under the white-label brand, and network reporting then comes from each workspace's exports.",
  },
];

export const segmentBySlug = (slug: string) => SEGMENTS.find((s) => s.slug === slug) ?? null;
