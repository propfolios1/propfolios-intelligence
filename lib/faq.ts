import { MARKETS } from "./markets";
import { PLANS } from "./plans";

/** Public questions and answers; also published as schema.org FAQPage data. */

const portals = (code: keyof typeof MARKETS) => MARKETS[code].portals.map((p) => p.name).join(", ");
const starter = PLANS.find((p) => p.id === "starter")!;

export type Faq = { q: string; a: string; group: "Product" | "Data and security" | "Commercial" };

export const FAQS: Faq[] = [
  {
    group: "Product",
    q: "What does Nakhla replace?",
    a: "The CRM, the listings tool, portal syndication, the commission spreadsheet, the compliance folder and the client update emails. Leads, listings, deals, commission, KYC and client reporting live in one system, and AI agents do the first draft of the repetitive work: replying to new leads, writing listings, preparing contracts and summarising the market.",
  },
  {
    group: "Product",
    q: "Which markets does Nakhla support?",
    a: "The United Arab Emirates and India have the full regulatory engine: closing checklists, registry parsers, transfer-tax calculators and regulator reports (goAML in the UAE, FINnet for FIU-IND in India). The United Kingdom, Singapore, Australia and the United States are localised for leads, listings, portals, rentals and fee invoicing in local currency and tax.",
  },
  {
    group: "Product",
    q: "Which property portals can we publish to and receive leads from?",
    a: `In the UAE: ${portals("AE")}. In India: ${portals("IN")}. In the United Kingdom: ${portals("GB")}. In Singapore: ${portals("SG")}. In Australia: ${portals("AU")}. In the United States: ${portals("US")}. Each portal needs the firm's own partner credentials or feed agreement; Nakhla connects them in Administration, Portals.`,
  },
  {
    group: "Product",
    q: "How does the AI lead response work, and can we control it?",
    a: "When an enquiry arrives by portal, website, email or WhatsApp, the assistant replies in the firm's voice, usually within seconds, asks the qualifying questions in the order that gets answers, and offers viewing slots from the agent's calendar. Administrators set office hours, the questions to ask, when to hand over to a person and what the assistant must never say. Every conversation is visible to the agent, who can take over at any point.",
  },
  {
    group: "Product",
    q: "How do we move from our current CRM?",
    a: "Use the migration tool in Administration. It connects to Follow Up Boss, Salesforce, HubSpot, Zoho, Propertybase or kvCORE, or reads a CSV export, maps the fields, runs a dry run that shows every record it would create or skip, and imports. An import can be rolled back. Most firms are working in Nakhla the same day; Enterprise includes an assisted migration.",
  },
  {
    group: "Product",
    q: "Does it work with WhatsApp?",
    a: "Yes, through the WhatsApp Business Platform on the firm's own number. Leads are answered and qualified on WhatsApp, agents reply from a shared inbox, and broadcasts use templates approved by Meta. Messages to people who replied STOP are never sent. Meta's conversation charges are billed by Meta at cost.",
  },
  {
    group: "Data and security",
    q: "Is our data used to train AI models?",
    a: "No. Agents run on Anthropic's commercial API, whose terms exclude customer content from model training. Each request contains only your firm's own records, agent memory is kept per firm, and administrators can switch any agent off.",
  },
  {
    group: "Data and security",
    q: "How is our data kept separate from other brokerages?",
    a: "By three independent layers: a tenant-scoped data layer that refuses any query without your firm's identifier, row-level security policies on every firm table in the database, and storage policies on your firm's file path. Any one of them would stop a cross-firm read; all three run on every request. The live count of security policies is published on the security page.",
  },
  {
    group: "Data and security",
    q: "Where is our data stored?",
    a: "In the region of the Supabase project serving your firm. Enterprise firms choose Mumbai, Frankfurt, London, Singapore, Sydney or North Virginia, or a dedicated deployment in the UAE for clients who require in-country storage. AI requests are processed in the United States in every case; the full sub-processor list is on the security page.",
  },
  {
    group: "Data and security",
    q: "Does Nakhla make us compliant with anti-money-laundering rules?",
    a: "It gives you the tools, not the obligation. Nakhla screens clients and counterparties against sanctions and PEP lists, runs due diligence files to the standard of each jurisdiction, flags cash and threshold transactions, and prepares goAML XML and FINnet reports for your compliance officer to review and file. Responsibility for reporting stays with the firm and its MLRO, as the regulators require.",
  },
  {
    group: "Commercial",
    q: "What does it cost, and what counts as an agent?",
    a: `Plans start at AED ${starter.priceAed.toLocaleString("en-US")} a month for up to ${starter.seats} agents, with 20% off for annual billing. An agent is any staff login: brokers, administrators and managers. Leads, listings, clients and portal users are unlimited on every plan, and AI usage is included under fair use. Prices exclude 5% UAE VAT.`,
  },
  {
    group: "Commercial",
    q: "Can we try it before we pay, and what happens after the trial?",
    a: "Start a 14-day trial without a card. Nakhla builds a workspace for your market with sample listings, leads and deals, which your own data replaces on import. Choose a plan at any point and the workspace upgrades in place. If you do not, it becomes read-only on day 14 and is permanently deleted on day 60, with reminders before each step.",
  },
];

export function faqJsonLd(faqs: Faq[] = FAQS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
