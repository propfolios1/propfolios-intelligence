import type { HandoffReason, LrLearning, QualField } from "@/db/schema-production";
import type { Extraction, Financing, Motivation, Timeline } from "./extract";

/**
 * The conversation policy: what the assistant knows, what it asks next, when
 * it offers viewings and when it hands over to an agent. The policy is pure,
 * so every decision is reproducible in tests and explainable on the
 * conversation page.
 */

export interface Known {
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  timeline: Timeline | null;
  areas: string[];
  bedrooms: number | null;
  motivation: Motivation | null;
  financing: Financing | null;
}

export const DEFAULT_ORDER: QualField[] = ["area", "budget", "timeline", "financing", "motivation"];

export const FIELD_LABEL: Record<QualField, string> = { budget: "Budget", timeline: "Timeline", area: "Area", motivation: "Motivation", financing: "Financing" };

export function has(k: Known, f: QualField) {
  switch (f) {
    case "budget":
      return k.budgetMax !== null || k.budgetMin !== null;
    case "timeline":
      return k.timeline !== null;
    case "area":
      return k.areas.length > 0;
    case "motivation":
      return k.motivation !== null;
    case "financing":
      return k.financing !== null;
  }
}

/** Fields that matter for this lead: tenants are not asked how they will finance a purchase. */
export function relevant(intent: string): QualField[] {
  return intent === "rent" ? ["area", "budget", "timeline", "motivation"] : [...DEFAULT_ORDER];
}

export const completeness = (k: Known, intent: string) => {
  const fields = relevant(intent);
  return Math.round((fields.filter((f) => has(k, f)).length / fields.length) * 100);
};

/**
 * The learned question order. Each field's answer rate (answered after being
 * asked, with a prior of one in two) ranks it; fields leads answer readily are
 * asked first, which keeps conversations moving. Ties keep the default order.
 */
export function questionOrder(learning: LrLearning | null, intent: string): QualField[] {
  const fields = relevant(intent);
  if (!learning) return fields;
  const rate = (f: QualField) => {
    const a = learning.answers[f];
    return ((a?.answered ?? 0) + 1) / ((a?.asked ?? 0) + 2);
  };
  return [...fields].sort((a, b) => rate(b) - rate(a) || fields.indexOf(a) - fields.indexOf(b));
}

export function merge(k: Known, e: Extraction): { known: Known; learned: QualField[] } {
  const next = { ...k, areas: [...k.areas] };
  const learned: QualField[] = [];
  if (e.budget) {
    next.budgetMin = e.budget.min ?? next.budgetMin;
    next.budgetMax = e.budget.max ?? next.budgetMax;
    next.currency = e.budget.currency ?? next.currency;
    learned.push("budget");
  }
  if (e.timeline) {
    next.timeline = e.timeline.value;
    learned.push("timeline");
  }
  if (e.areas) {
    for (const a of e.areas.value) if (!next.areas.includes(a)) next.areas.push(a);
    learned.push("area");
  }
  if (e.bedrooms) next.bedrooms = e.bedrooms.value;
  if (e.motivation) {
    next.motivation = e.motivation.value;
    learned.push("motivation");
  }
  if (e.financing) {
    next.financing = e.financing.value;
    learned.push("financing");
  }
  return { known: next, learned };
}

export type Decision =
  | { kind: "ask"; field: QualField }
  | { kind: "offer_viewing" }
  | { kind: "book"; slot: number }
  | { kind: "handoff"; reason: HandoffReason; detail: string }
  | { kind: "close" }
  | { kind: "complete" };

export interface PolicyInput {
  known: Known;
  intent: string;
  extraction: Extraction;
  learning: LrLearning | null;
  /** Slots offered in the previous assistant turn, if any. */
  pendingSlots: string[];
  /** Fields already asked in this conversation, with how many times. */
  askedCount: Partial<Record<QualField, number>>;
  /** The lead's budget in AED, for the high-value rule. */
  budgetAed: number | null;
  highValueAed: number;
  hasListing: boolean;
  firstTurn: boolean;
}

export function decide(p: PolicyInput): Decision {
  const i = p.extraction.intents;
  if (i.declines) return { kind: "close" };
  if (i.complaint) return { kind: "handoff", reason: "complaint", detail: "The lead expressed dissatisfaction; an agent should respond personally." };
  if (i.requestsAgent) return { kind: "handoff", reason: "requested_agent", detail: "The lead asked to speak with an agent." };
  if (i.complexQuestion) return { kind: "handoff", reason: "complex_question", detail: `The lead asked about ${i.complexQuestion}, which needs a qualified answer from an agent.` };
  if (p.pendingSlots.length && i.slotChoice) return { kind: "book", slot: i.slotChoice };
  if (p.budgetAed !== null && p.budgetAed >= p.highValueAed) return { kind: "handoff", reason: "high_value", detail: `Budget above the firm's high-value threshold; a senior agent should lead.` };
  const order = questionOrder(p.learning, p.intent);
  const missing = order.filter((f) => !has(p.known, f) && (f !== "area" || !p.hasListing));
  // Ask a field at most twice; a lead who ignores a question twice is not pressed further.
  const askable = missing.filter((f) => (p.askedCount[f] ?? 0) < 2);
  const core = (["area", "budget", "timeline"] as QualField[]).filter((f) => f !== "area" || !p.hasListing);
  if (i.wantsViewing && (p.hasListing || has(p.known, "area"))) return { kind: "offer_viewing" };
  if (!core.every((f) => has(p.known, f))) {
    if (askable.length) return { kind: "ask", field: askable[0]! };
    return { kind: "handoff", reason: "unresponsive", detail: "The lead has not answered the qualification questions after two attempts; an agent should call." };
  }
  if (!p.pendingSlots.length) return { kind: "offer_viewing" };
  if (askable.length) return { kind: "ask", field: askable[0]! };
  return { kind: "complete" };
}

/* ------------------------------------------------------------- the copy */

const fmt = (n: number, currency: string) => (currency === "INR" ? `₹${Math.round(n).toLocaleString("en-IN")}` : `${currency} ${Math.round(n).toLocaleString("en-US")}`);
const TIMELINE_TEXT: Record<Timeline, string> = { immediate: "a purchase as soon as possible", "3_months": "a timeline of three months", "6_months": "a timeline of six months", "12_months": "a timeline of about a year", exploring: "no fixed timeline yet" };
const FIN_TEXT: Record<Financing, string> = { cash: "a cash purchase", mortgage_approved: "a mortgage approved in principle", mortgage_needed: "a mortgage still to arrange", undecided: "financing still open" };
const MOT_TEXT: Record<Motivation, string> = { end_use: "a home for your own use", investment: "an investment purchase", relocation: "a relocation", upsizing: "a move to a larger home", residency_visa: "a purchase with residency in mind", other: "your stated purpose" };

export function acknowledge(k: Known, learned: QualField[], bedrooms: boolean) {
  const bits: string[] = [];
  for (const f of learned) {
    if (f === "budget") bits.push(k.budgetMin && k.budgetMax ? `a budget of ${fmt(k.budgetMin, k.currency)} to ${fmt(k.budgetMax, k.currency)}` : k.budgetMax ? `a budget of up to ${fmt(k.budgetMax, k.currency)}` : `a budget from ${fmt(k.budgetMin!, k.currency)}`);
    if (f === "area") bits.push(k.areas.join(" and "));
    if (f === "timeline") bits.push(TIMELINE_TEXT[k.timeline!]);
    if (f === "financing") bits.push(FIN_TEXT[k.financing!]);
    if (f === "motivation") bits.push(MOT_TEXT[k.motivation!]);
  }
  if (bedrooms && k.bedrooms !== null) bits.unshift(k.bedrooms === 0 ? "a studio" : `${k.bedrooms} ${k.bedrooms === 1 ? "bedroom" : "bedrooms"}`);
  if (!bits.length) return "";
  return `Noted: ${bits.length > 1 ? `${bits.slice(0, -1).join(", ")} and ${bits.at(-1)}` : bits[0]}.`;
}

export function question(f: QualField, ctx: { intent: string; currency: string; listing: string | null }) {
  const rent = ctx.intent === "rent";
  switch (f) {
    case "area":
      return "Which areas or communities are you considering?";
    case "budget":
      return rent ? `What annual rent are you working with, in ${ctx.currency}?` : `What budget range are you working with, in ${ctx.currency}?`;
    case "timeline":
      return rent ? "When would you like to move in?" : "When are you hoping to complete the purchase?";
    case "financing":
      return "Will this be a cash purchase or with a mortgage, and if a mortgage, is it approved in principle?";
    case "motivation":
      return rent ? "Is the move for work, family or another reason?" : "Is the property for your own use or as an investment?";
  }
}

export function composeReply(o: {
  decision: Decision;
  firstName: string;
  firstTurn: boolean;
  firm: string;
  agentName: string | null;
  listing: string | null;
  ack: string;
  intent: string;
  currency: string;
  slots: string[];
  booked: string | null;
  signature: string;
}) {
  const open = o.firstTurn ? `Good day ${o.firstName}, thank you for contacting ${o.firm}${o.listing ? ` about ${o.listing}` : ""}.` : "";
  const lines: string[] = [];
  if (open) lines.push(open);
  if (o.ack) lines.push(o.ack);
  const d = o.decision;
  if (d.kind === "ask") lines.push(question(d.field, { intent: o.intent, currency: o.currency, listing: o.listing }));
  if (d.kind === "offer_viewing") {
    if (o.slots.length) lines.push(`${o.agentName ?? "One of our agents"} can show you ${o.listing ?? "suitable homes"} at any of these times:\n${o.slots.map((s, i) => `${i + 1}. ${s}`).join("\n")}\nReply with 1, 2 or 3 to confirm, or suggest another time.`);
    else lines.push(`${o.agentName ?? "An agent"} will contact you shortly to arrange a viewing at a time that suits you.`);
  }
  if (d.kind === "book") lines.push(`Your viewing is confirmed for ${o.booked}${o.agentName ? ` with ${o.agentName}` : ""}. You will receive the address and a reminder beforehand. Reply here if you need to change the time.`);
  if (d.kind === "handoff") {
    const who = o.agentName ?? "One of our agents";
    lines.push(d.reason === "complaint" ? `I am sorry to hear this. ${who} will contact you personally shortly.` : d.reason === "complex_question" ? `That is a question our agents answer properly with the documents in front of them. ${who} will contact you shortly.` : d.reason === "high_value" ? `${who}, who handles our private client purchases, will contact you shortly to discuss your requirements in detail.` : `${who} will contact you shortly.`);
  }
  if (d.kind === "close") lines.push("Understood. We will not contact you further about this enquiry. Thank you for letting us know.");
  if (d.kind === "complete") lines.push(`Thank you. ${o.agentName ?? "Your agent"} has your requirements and will send a shortlist that matches them.`);
  if (o.signature) lines.push(o.signature);
  return lines.join("\n\n");
}
