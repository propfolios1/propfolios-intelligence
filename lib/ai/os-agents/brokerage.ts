import "server-only";
import { z } from "zod";
import { agentCore, defineAgent } from "../agents/define";
import { CAMPAIGN_WRITER_SYSTEM, CAMPAIGN_WRITER_VERSION } from "../prompts/campaign-writer_v1";
import { LEAD_QUALIFIER_SYSTEM, LEAD_QUALIFIER_VERSION } from "../prompts/lead-qualifier_v1";
import { LEAD_RESPONDER_SYSTEM, LEAD_RESPONDER_VERSION } from "../prompts/lead-responder_v1";
import { LISTING_WRITER_SYSTEM, LISTING_WRITER_VERSION } from "../prompts/listing-writer_v1";

const num = (v: number, currency: string) => (currency === "INR" ? `₹${Math.round(v).toLocaleString("en-IN")}` : `${currency} ${Math.round(v).toLocaleString("en-US")}`);
const first = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/* ---------------------------------------------------------- Lead qualifier */

const leadInput = z.object({
  lead: z.object({
    id: z.string(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    intent: z.string(),
    timeline: z.string(),
    source: z.string(),
    budgetMax: z.number().nullable(),
    currency: z.string(),
    locations: z.array(z.string()),
    message: z.string().nullable(),
    stage: z.string(),
  }),
  score: z.number(),
  factors: z.array(z.object({ label: z.string(), points: z.number(), detail: z.string() })),
  listing: z.object({ title: z.string(), price: z.number(), currency: z.string(), community: z.string() }).nullable(),
  activities: z.array(z.object({ type: z.string(), summary: z.string(), at: z.string() })),
});

export const leadQualifier = defineAgent({
  name: "lead-qualifier",
  label: "Lead qualifier",
  description: "Reads a lead, its itemised score and its history; names the gaps and writes the next action and opening line.",
  module: "brokerage",
  promptVersion: LEAD_QUALIFIER_VERSION,
  system: LEAD_QUALIFIER_SYSTEM,
  model: "fast",
  instruction: "Qualify this lead for the agent who will call it.",
  toolDescription: "Submit the qualification.",
  input: leadInput,
  output: agentCore.extend({ readiness: z.enum(["ready_for_viewing", "needs_qualification", "nurture", "disqualify"]), gaps: z.array(z.string()), nextAction: z.string(), openingLine: z.string() }),
  memory: { types: ["analyst_patterns"], entity: (i) => i.lead.id },
  sample: {
    lead: { id: "sample", name: "Rahul Khanna", email: "rahul.khanna@example.com", phone: "+971501234567", intent: "buy", timeline: "3_months", source: "propertyfinder", budgetMax: 2_200_000, currency: "AED", locations: ["Dubai Marina"], message: "Is the two-bedroom still available, and is parking included?", stage: "new" },
    score: 63,
    factors: [
      { label: "Contactability", points: 20, detail: "Phone and email" },
      { label: "Timeline", points: 20, detail: "3 months" },
    ],
    listing: { title: "Two-bedroom apartment, Marina Gate", price: 2_400_000, currency: "AED", community: "Dubai Marina" },
    activities: [],
  },
  replay: (i) => {
    const gaps: string[] = [];
    const topics: string[] = [];
    const gap = (g: string, topic: string) => (gaps.push(g), topics.push(topic));
    if (!i.lead.budgetMax) gap("Budget not stated", "the budget");
    if (i.lead.timeline === "exploring" || i.lead.timeline === "12_months") gap("Timeline beyond six months", "the timeline");
    gap("Financing: cash or mortgage not confirmed", "financing");
    if (!i.lead.phone) gap("No phone number; email only", "a phone number");
    const fit = i.listing && i.lead.budgetMax ? (i.listing.price - i.lead.budgetMax) / i.listing.price : null;
    const viewed = i.activities.some((a) => a.type === "viewing");
    const readiness: "ready_for_viewing" | "needs_qualification" | "nurture" | "disqualify" = i.score >= 70 || viewed ? "ready_for_viewing" : i.score >= 45 ? "needs_qualification" : i.lead.phone || i.lead.email ? "nurture" : "disqualify";
    const about = i.listing ? i.listing.title : i.lead.locations[0] ? `homes in ${i.lead.locations[0]}` : "your enquiry";
    const nextAction = readiness === "ready_for_viewing" ? "Offer two viewing slots this week and confirm financing on the call." : readiness === "needs_qualification" ? `Call within the hour; confirm ${topics[0] ?? "the budget"} before offering a viewing.` : "Add to the weekly new-listings email and review in 30 days.";
    return {
      headline: `${i.score >= 70 ? "Hot" : i.score >= 45 ? "Warm" : "Cold"} ${i.lead.intent} lead at ${i.score}/100${fit !== null ? `, budget ${fit <= 0 ? "covers" : `${Math.round(fit * 100)}% below`} the asking price` : ""}: ${nextAction.charAt(0).toLowerCase()}${nextAction.slice(1)}`,
      points: [
        { label: "Readiness", detail: readiness.replace(/_/g, " ") },
        { label: "Budget", detail: i.lead.budgetMax ? num(i.lead.budgetMax, i.lead.currency) : "Not on file" },
        { label: "Strongest factor", detail: [...i.factors].sort((a, b) => b.points - a.points)[0]?.label ?? "None" },
        { label: "Gaps", detail: gaps.join("; ") },
      ],
      confidence: i.lead.budgetMax && i.lead.phone ? 0.78 : 0.6,
      readiness,
      gaps,
      nextAction,
      openingLine: `Good afternoon ${first(i.lead.name)}, thank you for asking about ${about}. Before I suggest viewing times, are you buying with cash or with a mortgage?`,
    };
  },
});

/* ---------------------------------------------------------- Listing writer */

const listingInput = z.object({
  listing: z.object({
    id: z.string(),
    title: z.string(),
    purpose: z.enum(["sale", "rent"]),
    propertyType: z.string(),
    city: z.string(),
    community: z.string(),
    price: z.number(),
    currency: z.string(),
    rentPeriod: z.string().nullable(),
    bedrooms: z.number().nullable(),
    bathrooms: z.number().nullable(),
    area: z.number(),
    areaUnit: z.string(),
    features: z.array(z.string()),
    permitNumber: z.string().nullable(),
  }),
  market: z.object({ name: z.string(), listingPermit: z.string(), permitRequired: z.boolean() }),
});

export const listingWriter = defineAgent({
  name: "listing-writer",
  label: "Listing writer",
  description: "Writes the portal title, description and feature bullets from the listing's facts alone.",
  module: "brokerage",
  promptVersion: LISTING_WRITER_VERSION,
  system: LISTING_WRITER_SYSTEM,
  model: "fast",
  instruction: "Write the listing copy from these facts.",
  toolDescription: "Submit the listing copy.",
  input: listingInput,
  output: agentCore.extend({ title: z.string(), description: z.string(), features: z.array(z.string()).max(8) }),
  memory: { types: ["analyst_patterns"], entity: (i) => i.listing.id },
  sample: {
    listing: { id: "sample", title: "2BR Marina Gate", purpose: "sale", propertyType: "Apartment", city: "Dubai", community: "Dubai Marina", price: 2_400_000, currency: "AED", rentPeriod: null, bedrooms: 2, bathrooms: 3, area: 1280, areaUnit: "sqft", features: ["Balcony", "Covered parking", "Gym", "Pool"], permitNumber: "7120345611" },
    market: { name: "United Arab Emirates", listingPermit: "Trakheesi permit number", permitRequired: true },
  },
  replay: (i) => {
    const l = i.listing;
    const beds = l.bedrooms ? `${["Studio", "One", "Two", "Three", "Four", "Five", "Six"][l.bedrooms] ?? l.bedrooms}-bedroom` : "Studio";
    const type = l.propertyType.toLowerCase();
    const size = `${Math.round(l.area).toLocaleString("en-US")} ${l.areaUnit === "sqm" ? "sq m" : "sq ft"}`;
    const price = `${num(l.price, l.currency)}${l.purpose === "rent" ? (l.rentPeriod === "monthly" ? " a month" : " a year") : ""}`;
    const feats = l.features.slice(0, 8);
    const title = `${beds} ${type}, ${l.community}`.slice(0, 70);
    const description = [
      `A ${beds.toLowerCase()} ${type} of ${size} in ${l.community}, ${l.city}, offered ${l.purpose === "sale" ? "for sale" : "to let"} at ${price}.${l.bathrooms ? ` It has ${l.bathrooms} bathroom${l.bathrooms === 1 ? "" : "s"}.` : ""}`,
      feats.length ? `The home and building provide ${feats.map((f) => f.toLowerCase()).join(", ").replace(/, ([^,]*)$/, " and $1")}.` : "Further details of the building are available on request.",
      `${l.purpose === "sale" ? "Viewings are by appointment." : "Viewings are by appointment; the tenancy is registered on signing."}${l.permitNumber ? ` ${i.market.listingPermit}: ${l.permitNumber}.` : ""}`,
    ].join("\n\n");
    const missingPermit = i.market.permitRequired && !l.permitNumber;
    return {
      headline: missingPermit ? `Copy drafted, but the listing cannot be advertised in ${i.market.name} until the ${i.market.listingPermit.toLowerCase()} is added.` : `Portal-ready copy for the ${beds.toLowerCase()} ${type} in ${l.community}, from the listing's facts only.`,
      points: [
        { label: "Title", detail: title },
        { label: "Length", detail: `${description.split(/\s+/).length} words` },
        { label: "Facts used", detail: `${feats.length} features, size, price${l.permitNumber ? ", permit" : ""}` },
        ...(missingPermit ? [{ label: "Blocking", detail: `${i.market.listingPermit} missing` }] : []),
      ],
      confidence: feats.length >= 3 ? 0.82 : 0.6,
      title,
      description,
      features: feats,
    };
  },
});

/* --------------------------------------------------------- Campaign writer */

const campaignInput = z.object({
  firm: z.string(),
  channel: z.enum(["email", "social", "portal_boost", "print"]),
  brief: z.string().min(5),
  segment: z.object({ label: z.string(), size: z.number() }),
  listing: z.object({ title: z.string(), community: z.string(), price: z.number(), currency: z.string(), permitNumber: z.string().nullable(), permitLabel: z.string() }).nullable(),
});

export const campaignWriter = defineAgent({
  name: "campaign-writer",
  label: "Campaign writer",
  description: "Drafts the subject, preview and body for an email or social campaign from a brief and a listing.",
  module: "brokerage",
  promptVersion: CAMPAIGN_WRITER_VERSION,
  system: CAMPAIGN_WRITER_SYSTEM,
  model: "fast",
  instruction: "Draft this campaign.",
  toolDescription: "Submit the campaign draft.",
  input: campaignInput,
  output: agentCore.extend({ subject: z.string(), preview: z.string(), body: z.string() }),
  memory: { types: ["analyst_patterns"] },
  sample: { firm: "Nakhla Realty", channel: "email", brief: "Introduce the new two-bedroom listing in Dubai Marina to qualified buyers.", segment: { label: "Buyers, budget above AED 2M, Dubai", size: 48 }, listing: { title: "Two-bedroom apartment, Marina Gate", community: "Dubai Marina", price: 2_400_000, currency: "AED", permitNumber: "7120345611", permitLabel: "Trakheesi permit" } },
  replay: (i) => {
    const l = i.listing;
    const subject = (l ? `${l.title}: now available` : i.brief.split(/[.;]/)[0]!).slice(0, 60);
    const preview = l ? `${l.community}, ${num(l.price, l.currency)}` : i.segment.label;
    const body =
      i.channel === "social"
        ? `${l ? `${l.title} in ${l.community}, offered at ${num(l.price, l.currency)}.` : i.brief} Viewings by appointment with ${i.firm}.${l?.permitNumber ? ` ${l.permitLabel}: ${l.permitNumber}.` : ""}`
        : [
            "Dear client,",
            l ? `We have taken instructions on ${l.title.toLowerCase()} in ${l.community}, offered at ${num(l.price, l.currency)}. Given what you have told us about your search, we wanted you to hear of it before it is advertised more widely.` : i.brief,
            "Reply to this email or call your adviser to arrange a viewing or to receive the floor plan and service-charge history.",
            l?.permitNumber ? `${l.permitLabel}: ${l.permitNumber}.` : "",
            `${i.firm}\nYou receive this because you asked to hear about new listings. Unsubscribe at any time from the link below.`,
          ]
            .filter(Boolean)
            .join("\n\n");
    return {
      headline: i.segment.size ? `Draft ready for ${i.segment.size} recipients in "${i.segment.label}".` : `Draft ready, but the segment "${i.segment.label}" is empty.`,
      points: [
        { label: "Subject", detail: subject },
        { label: "Channel", detail: i.channel.replace("_", " ") },
        { label: "Audience", detail: `${i.segment.size} with marketing consent` },
      ],
      confidence: l ? 0.8 : 0.65,
      subject,
      preview,
      body,
    };
  },
});

/* ---------------------------------------------------------- Lead responder */

const responderInput = z.object({
  firm: z.string(),
  channel: z.enum(["whatsapp", "email", "website", "portal"]),
  lead: z.object({ firstName: z.string(), intent: z.string(), listing: z.string().nullable() }),
  decision: z.string(),
  draft: z.string(),
  message: z.string(),
  history: z.array(z.object({ role: z.enum(["lead", "assistant", "agent"]), text: z.string() })).max(12),
  examples: z.array(z.string()).max(8),
});

export const leadResponder = defineAgent({
  name: "lead-responder",
  label: "Lead responder",
  description: "Replies to new enquiries within seconds on WhatsApp and email: qualifies budget, timeline, area, motivation and financing, offers viewing slots, and hands over to an agent.",
  module: "brokerage",
  promptVersion: LEAD_RESPONDER_VERSION,
  system: LEAD_RESPONDER_SYSTEM,
  model: "fast",
  instruction: "Rewrite the draft reply in the firm's voice without changing what it does.",
  toolDescription: "Submit the reply to send.",
  input: responderInput,
  output: agentCore.extend({ reply: z.string().min(1).max(1500) }),
  maxTokens: 900,
  sample: {
    firm: "Nakhla Demo Brokerage",
    channel: "whatsapp",
    lead: { firstName: "Rania", intent: "buy", listing: "Two-bedroom apartment, Marina Gate" },
    decision: "ask:timeline",
    draft: "Noted: Dubai Marina and a budget of up to AED 2,500,000. When are you hoping to complete the purchase?",
    message: "Looking in the Marina, up to 2.5m.",
    history: [],
    examples: ["Good afternoon, thank you for your patience. I can show you the unit on Saturday morning if that suits."],
  },
  replay: (i) => ({
    headline: `Reply to ${i.lead.firstName} on ${i.channel === "whatsapp" ? "WhatsApp" : "email"}: ${i.decision.startsWith("ask:") ? `asks about ${i.decision.slice(4)}` : i.decision.replace(/_/g, " ")}`,
    points: [
      { label: "Decision", detail: i.decision.replace(/_/g, " ") },
      { label: "Channel", detail: i.channel },
    ],
    confidence: 0.9,
    reply: i.draft,
  }),
});

export const BROKERAGE_AGENTS = [leadQualifier, listingWriter, campaignWriter, leadResponder] as const;
