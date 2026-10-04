import { DIRECT_SOURCES, MARKETS, type MarketCode } from "@/lib/markets";
import { MODULE_LABEL, MODULE_MIN_PLAN, PLANS } from "@/lib/plans";
import { ACCESS_ROLES, ROLE_LABEL } from "@/lib/rbac/permissions";

/**
 * Documentation pages, as structured content rendered by app/docs. Facts are
 * read from the registries the product uses (markets, plans, roles) so the
 * documentation changes when the product does.
 */

export type Block =
  | { p: string }
  | { h: string }
  | { list: string[] }
  | { steps: { title: string; body: string }[] }
  | { code: string; lang: string; title?: string }
  | { table: { head: string[]; rows: string[][] } }
  | { note: string; tone?: "info" | "warning" };

export type DocPage = { slug: string; group: string; title: string; summary: string; blocks: Block[] };

const APP = "https://app.nakhla.ai";
const portalsOf = (m: MarketCode) => MARKETS[m].portals;

export const DOC_GROUPS = ["Getting started", "Migration", "Portals", "Developers", "Compliance", "Enterprise"] as const;

export const DOCS: DocPage[] = [
  {
    slug: "getting-started",
    group: "Getting started",
    title: "Your first day on Nakhla",
    summary: "From trial to a working brokerage: team, data, portals and the AI lead response.",
    blocks: [
      { p: "A trial workspace is ready about a minute after you sign up. It is filled with sample listings, leads and deals for your market, so every screen shows how it works with real volume. Your own data replaces the samples when you import it." },
      {
        steps: [
          { title: "Invite your team", body: "Administration, Users. Invite agents by email and give each an access role. Up to three colleagues can join a trial; seats on a paid plan follow the plan's agent allowance." },
          { title: "Import your data", body: "Administration, Data migration. Connect your CRM or upload a CSV. Run the dry run, check what will be created, then import. See the migration guide." },
          { title: "Connect your portals", body: "Administration, Portals. Enter the partner credentials or copy the feed address into each portal. New enquiries start arriving as leads and listings publish on the next sync." },
          { title: "Switch on lead response", body: "Administration, Lead response. Set office hours, the questions to ask and when to hand over. Send yourself a test enquiry and read the reply." },
          { title: "Set commission structures", body: "Administration, Commission structures. Start from a preset (flat, tiered, team, referral, co-broke) and adjust the splits. Every deal's commission is then calculated to the fil or paisa." },
          { title: "Choose a plan", body: "Administration, Billing. Pay by card through Stripe for Starter and Professional, or by bank transfer against an AED invoice. The workspace upgrades in place." },
        ],
      },
      { note: "The trial runs for 14 days with full access. If no plan is chosen, the workspace becomes read-only on day 14 and is deleted on day 60, with email reminders before each step." },
    ],
  },
  {
    slug: "getting-started/roles",
    group: "Getting started",
    title: "Roles and permissions",
    summary: "Who can see and do what, and how to compose your own roles.",
    blocks: [
      { p: "Every person has a base role that decides which workspace they use (administration, the agent workspace or the client portal) and an access role that decides what they may do inside it. Row-level security in the database follows the base role, so a client can never read another client's records whatever the application does." },
      { table: { head: ["Access role", "Key"], rows: ACCESS_ROLES.filter((r) => !r.startsWith("platform_")).map((r) => [ROLE_LABEL[r], r]) } },
      { p: "On Enterprise, administrators compose custom roles from the permission catalogue under Administration, Roles, and map identity provider groups to them for SCIM provisioning. A custom role replaces the permissions of the access role; its base role still applies." },
      { p: "Refused actions are recorded in the audit log. The permission suggester on the Users page reads the last ninety days of a person's actions and recommends the least-privileged role that covers their work." },
    ],
  },
  {
    slug: "migration",
    group: "Migration",
    title: "Moving from your current CRM",
    summary: "Connect, map, dry-run, import and, if needed, roll back.",
    blocks: [
      { p: "The migration tool reads leads and listings from Follow Up Boss, Salesforce (including Propertybase), HubSpot, Zoho CRM and kvCORE through their APIs, or from a CSV export of any system. Nothing is written until you approve the dry run." },
      {
        steps: [
          { title: "Connect", body: "Choose the source and authorise it, or upload the CSV. Credentials are sealed with AES-256-GCM and can be removed when the import finishes." },
          { title: "Extract", body: "Records are copied into a staging area inside your workspace. Large CRMs are read in pages with the source's rate limits respected." },
          { title: "Map", body: "Columns are matched to Nakhla fields automatically by name; adjust any mapping and the value maps for stages, sources and intent." },
          { title: "Dry run", body: "Every record is validated and de-duplicated against your existing data. The report lists what will be created, merged or skipped, and why." },
          { title: "Import", body: "Records are created with their original creation dates and source IDs, so reports and de-duplication keep working." },
          { title: "Roll back", body: "For 24 hours after it finishes, an import can be undone as a whole: every record it created is removed." },
        ],
      },
      { note: "Enterprise includes an assisted migration: our team runs the import with you and checks a sample of records against the source." },
    ],
  },
  {
    slug: "migration/csv",
    group: "Migration",
    title: "CSV format",
    summary: "Columns the importer recognises for leads and listings.",
    blocks: [
      { p: "Any CSV with a header row works. Column names are matched loosely (case, spaces and punctuation are ignored), and anything unmatched can be mapped by hand. Save the file as UTF-8 (in Excel, choose CSV UTF-8), so Arabic and Devanagari names survive." },
      { h: "Leads" },
      { table: { head: ["Field", "Recognised column names"], rows: [["Full name", "name, full name, contact name, client name (or first name and last name)"], ["Email", "email, email address, primary email"], ["Phone", "phone, mobile, phone number, whatsapp"], ["Source", "source, lead source, channel"], ["Stage", "stage, status, lead status, lifecycle stage"], ["Budget", "budget, max price, min price"], ["Preferred areas", "location, area, community, city (comma separated)"], ["Created on", "created, created at, date added"], ["Marketing consent", "consent, opt in, subscribed"]] } },
      { h: "Listings" },
      { table: { head: ["Field", "Recognised column names"], rows: [["Title", "title, name, headline (required)"], ["Price", "price, asking price, rent (required)"], ["City", "city, emirate, town (required)"], ["Community", "community, area, neighbourhood"], ["Sale or rent", "purpose, offering type, listing type"], ["Bedrooms", "bedrooms, beds, br"], ["Permit", "permit number, trakheesi, rera number"]] } },
      { code: "name,email,phone,source,stage,budget,location,created at\nAisha Rahman,aisha@example.com,+971501234567,Property Finder,qualified,3500000,\"Dubai Marina, JLT\",2026-05-14", lang: "csv", title: "leads.csv" },
    ],
  },
  {
    slug: "portals",
    group: "Portals",
    title: "Publishing to portals and receiving their leads",
    summary: "How syndication and lead capture work in each market.",
    blocks: [
      { p: "Nakhla publishes listings to portals in two ways: through the portal's partner API, where the portal offers one to agencies, or through an XML feed that the portal collects on its own schedule. Enquiries come back by the portal's lead API, by email forwarding or by the inbound lead endpoint." },
      { table: { head: ["Market", "Portals"], rows: (Object.keys(MARKETS) as MarketCode[]).map((m) => [MARKETS[m].name, portalsOf(m).map((p) => p.name).join(", ")]) } },
      { p: "Every portal needs the firm's own partner agreement and credentials. Field mappings can be edited per firm under Administration, Portals, without code changes, when a portal changes its specification." },
      { note: "Listings without the permit or registration the market requires are held back from publishing and flagged on the listing.", tone: "warning" },
    ],
  },
  {
    slug: "portals/uae",
    group: "Portals",
    title: "UAE: Bayut, Property Finder and Dubizzle",
    summary: "Permits, feeds and lead forwarding for Dubai and Abu Dhabi.",
    blocks: [
      { p: `Every advertised listing in Dubai needs a ${MARKETS.AE.listingPermit}, and the advertising agent's ${MARKETS.AE.agentLicence}. Nakhla blocks publishing until both are on the listing.` },
      {
        steps: [
          { title: "Request partner access", body: "Ask your account manager at each portal for API access for your agency, or for a feed collection set-up." },
          { title: "Enter the credentials", body: "Administration, Portals, then the portal. Paste the client ID and secret or API key; they are sealed at rest." },
          { title: "Or share the feed address", body: "Copy the signed feed address shown for the portal and give it to the portal's integration team. The address carries a token unique to your firm and portal." },
          { title: "Forward enquiries", body: "Point the portal's lead notifications at your firm's inbound email address, or ask the portal to post them to the inbound lead endpoint with an API key that has the leads:write scope." },
        ],
      },
      { code: `${APP}/api/feeds/{your-firm-id}/bayut?token=…`, lang: "text", title: "Feed address format" },
    ],
  },
  {
    slug: "portals/india",
    group: "Portals",
    title: "India: 99acres, MagicBricks, Housing.com and NoBroker",
    summary: "RERA numbers, feeds and lead capture for Indian listings.",
    blocks: [
      { p: `Listings in projects registered under RERA must show the ${MARKETS.IN.listingPermit}, and agents their ${MARKETS.IN.agentLicence}. Nakhla carries both onto every listing and portal payload.` },
      { p: "MagicBricks, 99acres and Housing.com offer listing APIs to partner agencies under agreement; NoBroker accepts leads by email forwarding. Prices are published in rupees, with crore and lakh formatting on the firm's website." },
      { list: ["Leads from Indian portals arrive with the portal's enquiry ID, which Nakhla keeps for de-duplication.", "For non-resident buyers, the Maharashtra agreement for sale template adds the FEMA clause, and the cross-border agent covers repatriation limits."] },
    ],
  },
  {
    slug: "portals/international",
    group: "Portals",
    title: "United Kingdom, Singapore, Australia and United States",
    summary: "Rightmove, Zoopla, PropertyGuru, realestate.com.au, Zillow and others.",
    blocks: [
      { p: "Rightmove's Real Time Datafeed and Zoopla's Real-time Listings authenticate with a TLS client certificate issued to each branch. Upload the certificate and key under Administration, Portals; Nakhla presents it on every call." },
      { table: { head: ["Market", "Disclosure the listing must carry"], rows: (["GB", "SG", "AU", "US"] as MarketCode[]).map((m) => [MARKETS[m].name, MARKETS[m].listingPermit]) } },
      { p: "In these markets Nakhla localises leads, listings, syndication, rentals and fee invoicing, with local currency and tax on the agency fee. Regulator closing workflows are on the roadmap." },
    ],
  },
  {
    slug: "api/authentication",
    group: "Developers",
    title: "Authentication, scopes and limits",
    summary: "API keys, what each scope allows, rate limits and errors.",
    blocks: [
      { p: "Create keys under Administration, API. Each key belongs to one firm, carries one or more scopes, has its own per-minute limit and, optionally, an expiry. The secret is shown once; Nakhla stores only its hash." },
      { code: `curl ${APP}/api/mcp/list_properties \\\n  -H "Authorization: Bearer nk_live_…" \\\n  -H "Content-Type: application/json" \\\n  -d '{"market":"AE","limit":5}'`, lang: "bash" },
      { table: { head: ["Scope", "Allows"], rows: [["mcp", "The MCP server and the MCP tools over HTTP"], ["leads:write", "POST /api/leads/inbound/{source}"]] } },
      { table: { head: ["Status", "Meaning"], rows: [["401", "Missing, unknown, revoked or expired key"], ["402", "The firm's plan does not include the feature"], ["403", "The key lacks the scope, or the role lacks the permission"], ["422", "The request failed validation; the error names the field"], ["429", "Over the key's per-minute limit; Retry-After gives the seconds to wait"]] } },
      { p: "Every call is counted by key, day and route, and shown on the API page with throttled and failed calls. Errors are JSON with a single error field written for a person to read." },
    ],
  },
  {
    slug: "mcp",
    group: "Developers",
    title: "Model Context Protocol server",
    summary: "Give Claude, or any MCP client, safe access to your firm's data.",
    blocks: [
      { p: `Nakhla runs an MCP server at ${APP}/api/mcp using the Streamable HTTP transport. Tools act inside the firm the key belongs to, are recorded in the audit log, and respect the key's scope and rate limit.` },
      { code: `claude mcp add --transport http nakhla ${APP}/api/mcp \\\n  --header "Authorization: Bearer nk_live_…"`, lang: "bash", title: "Claude Code" },
      { code: `{\n  "mcpServers": {\n    "nakhla": {\n      "command": "npx",\n      "args": ["-y", "mcp-remote", "${APP}/api/mcp", "--header", "Authorization: Bearer \${NAKHLA_API_KEY}"],\n      "env": { "NAKHLA_API_KEY": "nk_live_…" }\n    }\n  }\n}`, lang: "json", title: "Claude Desktop (claude_desktop_config.json)" },
      { p: "The same tools are available as plain HTTP endpoints at /api/mcp/{tool}, documented in the API reference with their input schemas." },
      { note: "Use a key with only the mcp scope for assistants, and a separate key per person or integration so each can be revoked on its own." },
    ],
  },
  {
    slug: "webhooks",
    group: "Developers",
    title: "Webhooks",
    summary: "Signed notifications when leads arrive, deals move and commission is paid.",
    blocks: [
      { p: "Register up to ten HTTPS endpoints under Administration, API, Webhooks, and choose the events each receives. Nakhla sends a POST with a JSON body within about a minute of the event." },
      { code: `{\n  "id": "evt_3f2a9c0d1e4b5a6c7d8e9f00",\n  "type": "lead.created",\n  "created": "2026-10-04T08:15:02.114Z",\n  "tenant_id": "4b1c…",\n  "data": { "lead_id": "…", "reference": "LD-0412", "name": "Aisha Rahman", "source": "propertyfinder", "market": "AE", "intent": "buy", "budget_max": 3500000, "currency": "AED" }\n}`, lang: "json", title: "Payload" },
      { h: "Verifying the signature" },
      { p: "Each request carries Nakhla-Signature: t=<unix seconds>,v1=<hex>. Compute HMAC-SHA256 of the timestamp, a full stop and the raw body with the endpoint's secret, compare in constant time, and reject timestamps more than five minutes old." },
      { code: `import { createHmac, timingSafeEqual } from "node:crypto";\n\nexport function verify(secret: string, rawBody: string, header: string) {\n  const [, t, v1] = header.match(/t=(\\d+),v1=([0-9a-f]{64})/) ?? [];\n  if (!t || Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;\n  const want = createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");\n  return timingSafeEqual(Buffer.from(want), Buffer.from(v1));\n}`, lang: "ts", title: "Node.js" },
      { code: `import hmac, hashlib, re, time\n\ndef verify(secret: str, raw_body: bytes, header: str) -> bool:\n    m = re.match(r"t=(\\d+),v1=([0-9a-f]{64})", header or "")\n    if not m or abs(time.time() - int(m[1])) > 300:\n        return False\n    want = hmac.new(secret.encode(), m[1].encode() + b"." + raw_body, hashlib.sha256).hexdigest()\n    return hmac.compare_digest(want, m[2])`, lang: "python", title: "Python" },
      { h: "Retries" },
      { p: "Return any 2xx status within ten seconds. Anything else is retried after 1 minute, 5 minutes, 30 minutes, 2 hours and 12 hours. An endpoint that fails 20 deliveries in a row is paused and the firm sees why on the API page. Deliveries carry a unique ID in Nakhla-Delivery; use the event id to ignore duplicates." },
    ],
  },
  {
    slug: "compliance",
    group: "Compliance",
    title: "Anti-money-laundering by jurisdiction",
    summary: "Screening, due diligence and regulator reports in each market.",
    blocks: [
      { p: "Nakhla screens clients, counterparties and beneficial owners against consolidated sanctions and politically exposed persons data through OpenSanctions, keeps due diligence files to each jurisdiction's standard, and prepares regulator reports for the firm's compliance officer to review and file. Filing remains the firm's responsibility." },
      { table: { head: ["Jurisdiction", "Supervisor", "Reports go to", "Nakhla prepares"], rows: [["United Arab Emirates", "Ministry of Economy (real estate brokers)", "UAE Financial Intelligence Unit via goAML", "STR and REAR files in goAML XML"], ["India", "Financial Intelligence Unit, India (FIU-IND)", "FIU-IND via FINnet 2.0", "STR and CTR batches for FINnet"], ["United Kingdom", "HMRC (estate agency AML supervision)", "National Crime Agency (SARs)", "SAR narrative and evidence pack"], ["Singapore", "Council for Estate Agencies (CEA)", "Suspicious Transaction Reporting Office (STRO)", "STR narrative and evidence pack"]] } },
      { p: "Records are kept for seven years from the end of the relationship, beyond the five-year minimum each of these regimes sets, and cannot be edited after a decision is recorded." },
      { note: "Screening without an OpenSanctions key uses a small labelled sample list for demonstration only. Add OPENSANCTIONS_API_KEY before relying on screening results.", tone: "warning" },
    ],
  },
  {
    slug: "compliance/data-protection",
    group: "Compliance",
    title: "Data protection: GDPR, UAE PDPL and India DPDP",
    summary: "Roles, agreements, subject requests and retention.",
    blocks: [
      { p: "The firm is the controller of its clients' and leads' personal data; Nakhla is the processor. A Data Processing Agreement under Article 28 GDPR, with the 2021 Standard Contractual Clauses and the UK Addendum, is available from privacy@nakhla.ai and covers the UAE PDPL and India's DPDP Act as well." },
      { list: ["Consent to marketing is recorded per lead with its source and time; only consenting leads enter campaigns.", "Access, correction, export and erasure requests are handled under Administration, Compliance, Data protection, with a deadline per jurisdiction.", "Erasure follows a checklist that confirms identity and checks AML and tax retention before personal data is erased or anonymised.", "Sub-processors and their locations are listed on the security page and in Administration, Data residency."] },
      { p: "Enterprise firms choose the storage region; see Data residency. AI requests are processed in the United States in every case and are excluded from model training under Anthropic's commercial terms." },
    ],
  },
  {
    slug: "enterprise/sso",
    group: "Enterprise",
    title: "Single sign-on",
    summary: "SAML 2.0 or OpenID Connect with Okta, Microsoft Entra ID, Google Workspace and others.",
    blocks: [
      {
        steps: [
          { title: "Create the application", body: "In your identity provider, create a SAML 2.0 application for Nakhla using the entity ID and attributes shown under Administration, Single sign-on." },
          { title: "Upload the metadata", body: "Download the provider's metadata XML and upload it. Nakhla reads the entity ID, sign-on URL and signing certificate and checks the certificate's validity." },
          { title: "Verify your domains", body: "Add the TXT record shown for each email domain at your DNS provider, then check. A domain can belong to only one firm." },
          { title: "Switch on", body: "When every readiness check passes, switch on. Optionally require single sign-on for everyone on the verified domains, and create accounts on first sign-in." },
        ],
      },
      { note: "Keep one administrator on a domain outside single sign-on as a break-glass account, in case the identity provider is unavailable.", tone: "warning" },
    ],
  },
  {
    slug: "enterprise/scim",
    group: "Enterprise",
    title: "SCIM provisioning",
    summary: "Create, update and deactivate staff accounts from your identity provider.",
    blocks: [
      { p: `Create a token under Administration, SCIM provisioning, and enter ${APP}/api/scim/v2 with the token in your identity provider's provisioning settings. userName (the email address) is the unique identifier.` },
      { table: { head: ["Operation", "Endpoint"], rows: [["Find a user", "GET /Users?filter=userName eq \"…\""], ["Create", "POST /Users"], ["Replace", "PUT /Users/{id}"], ["Update or deactivate", "PATCH /Users/{id}"], ["Deactivate", "DELETE /Users/{id}"], ["Capabilities", "GET /ServiceProviderConfig"]] } },
      { p: "Roles come from the roles attribute (tenant_admin, analyst, or a custom role key) or from group names mapped to custom roles. Deactivated users cannot sign in, and their work stays attributed to them. Seat limits apply to provisioning." },
    ],
  },
  {
    slug: "enterprise/plans",
    group: "Enterprise",
    title: "What each plan includes",
    summary: "Agent allowances and the modules that depend on the plan.",
    blocks: [
      { table: { head: ["Plan", "Agents", "Price per month"], rows: PLANS.map((p) => [p.name, p.seats === null ? "Unlimited" : String(p.seats), `AED ${p.priceAed.toLocaleString("en-US")}`]) } },
      { table: { head: ["Module", "Included from"], rows: (Object.keys(MODULE_MIN_PLAN) as (keyof typeof MODULE_MIN_PLAN)[]).map((m) => [MODULE_LABEL[m], PLANS.find((p) => p.id === MODULE_MIN_PLAN[m])!.name]) } },
      { p: `Everything else, including CRM, listings, portals, the AI lead response, commission, compliance and the client portal, is on every plan. Direct lead sources such as ${DIRECT_SOURCES.slice(0, 3).map((d) => d.name).join(", ")} work on every plan.` },
    ],
  },
];

export const docBySlug = (slug: string) => DOCS.find((d) => d.slug === slug) ?? null;
