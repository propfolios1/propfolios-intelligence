import type { QualField } from "@/db/schema-production";

/**
 * Deterministic reading of a lead's message: budget, timeline, areas,
 * bedrooms, motivation and financing, each with the words it came from, plus
 * the intents that change the conversation (asks for an agent, complains,
 * asks a question that needs a professional, wants a viewing, picks a slot,
 * withdraws). The language model, when configured, writes the reply; it never
 * overrides what is extracted here, so a qualification is always auditable to
 * the lead's own words.
 */

export type Timeline = "immediate" | "3_months" | "6_months" | "12_months" | "exploring";
export type Motivation = "end_use" | "investment" | "relocation" | "upsizing" | "residency_visa" | "other";
export type Financing = "cash" | "mortgage_approved" | "mortgage_needed" | "undecided";

export interface Extraction {
  budget: { min: number | null; max: number | null; currency: string | null; evidence: string } | null;
  timeline: { value: Timeline; evidence: string } | null;
  areas: { value: string[]; evidence: string } | null;
  bedrooms: { value: number; evidence: string } | null;
  motivation: { value: Motivation; evidence: string } | null;
  financing: { value: Financing; evidence: string } | null;
  intents: {
    requestsAgent: boolean;
    complaint: boolean;
    complexQuestion: string | null;
    wantsViewing: boolean;
    declines: boolean;
    slotChoice: number | null;
  };
}

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, a: 1, an: 1 };
const MULT: Record<string, number> = { k: 1e3, thousand: 1e3, m: 1e6, mn: 1e6, mil: 1e6, million: 1e6, millions: 1e6, bn: 1e9, billion: 1e9, cr: 1e7, crore: 1e7, crores: 1e7, lakh: 1e5, lakhs: 1e5, lac: 1e5, lacs: 1e5, l: 1e5 };
const CUR: Record<string, string> = { aed: "AED", dirham: "AED", dirhams: "AED", dhs: "AED", usd: "USD", "$": "USD", "us$": "USD", dollars: "USD", inr: "INR", rs: "INR", "rs.": "INR", "₹": "INR", rupees: "INR", gbp: "GBP", "£": "GBP", pounds: "GBP", sgd: "SGD", "s$": "SGD", aud: "AUD", "a$": "AUD", eur: "EUR", "€": "EUR" };

/** The sentence or clause that contains a match: what is shown as evidence. */
function clause(text: string, index: number) {
  // Sentence ends: a full stop, question mark or exclamation followed by a space or the end, or a line break; not a decimal point.
  const ends = [...text.matchAll(/[.?!](?=\s|$)|\n/g)].map((m) => m.index!);
  const start = ends.filter((i) => i < index).reduce((_, i) => i + 1, 0);
  const end = ends.find((i) => i >= index);
  return text.slice(start, end === undefined ? text.length : end + 1).trim().slice(0, 200);
}

const AMOUNT = /(aed|usd|us\$|inr|rs\.?|gbp|sgd|s\$|aud|a\$|eur|dhs|[$£₹€])?\s?(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s?(k|thousand|mn|mil|millions?|m|bn|billion|crores?|cr|lakhs?|lacs?|l)?\b\s?(aed|dirhams?|dhs|usd|dollars|inr|rupees|gbp|pounds|sgd|aud|eur)?/gi;
const NOT_MONEY_AFTER = /^\s*(-|to)?\s*(bed|br\b|bhk|bedroom|bath|month|year|yr|week|day|sq|sqft|square|minute|min\b|hour|pm\b|am\b|floor|storey|cheque|car|park|kid|child|people|person|st\b|nd\b|rd\b|th\b|%|percent)/i;

type Amount = { value: number; currency: string | null; hasUnit: boolean; index: number; end: number };

function amounts(text: string): Amount[] {
  const out: Amount[] = [];
  for (const m of text.matchAll(AMOUNT)) {
    const [, pre, rawNum, unit, post] = m;
    const idx = m.index ?? 0;
    const end = idx + m[0].length;
    if (!pre && !unit && !post && NOT_MONEY_AFTER.test(text.slice(end))) continue;
    if (/^\d+$/.test(rawNum!) && !pre && !unit && !post && Number(rawNum) < 10_000) {
      out.push({ value: Number(rawNum), currency: null, hasUnit: false, index: idx, end });
      continue;
    }
    const n = Number(rawNum!.replace(/,/g, ""));
    if (!Number.isFinite(n)) continue;
    const mult = unit ? (MULT[unit.toLowerCase()] ?? 1) : 1;
    // "2 m" next to "bed" or "sq" is not money; a bare "l" only counts in Indian context words.
    if (unit?.toLowerCase() === "m" && /^\s*(2|²|sq)/i.test(text.slice(end))) continue;
    const currency = (pre && CUR[pre.toLowerCase()]) || (post && CUR[post.toLowerCase()]) || null;
    out.push({ value: n * mult, currency, hasUnit: Boolean(unit || pre || post), index: idx, end });
  }
  return out;
}

export function parseBudget(text: string, defaultCurrency: string): Extraction["budget"] {
  const all = amounts(text);
  const money = all.filter((a) => a.hasUnit || a.value >= 10_000);
  if (!money.length) return null;
  const lower = text.toLowerCase();
  // A range: "between 2 and 3 million", "2-3m", "2 to 3.5 million".
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[i]!;
    const b = all[i + 1]!;
    const gap = text.slice(a.end, b.index);
    if (/^\s*(-|–|to|and)\s*$/i.test(gap) && b.hasUnit) {
      const scale = a.hasUnit ? 1 : b.value / Number(text.slice(b.index, b.end).match(/\d[\d,.]*/)![0].replace(/,/g, ""));
      const min = a.value * scale;
      const max = b.value;
      if (min > 0 && max >= min && max >= 10_000) return { min, max, currency: b.currency ?? a.currency ?? defaultCurrency, evidence: clause(text, a.index) };
    }
  }
  const pick = money.sort((x, y) => y.value - x.value)[0]!;
  const before = lower.slice(Math.max(0, pick.index - 24), pick.index);
  const floor = /(at least|minimum|min\.?|from|above|over|more than|starting)\s*$/.test(before);
  return { min: floor ? pick.value : null, max: floor ? null : pick.value, currency: pick.currency ?? defaultCurrency, evidence: clause(text, pick.index) };
}

const TIMELINES: [Timeline, RegExp][] = [
  ["exploring", /\b(just (looking|browsing)|browsing|exploring|no rush|not in a (hurry|rush)|researching|early stages?|no fixed timeline|in the future|someday)\b/i],
  ["immediate", /\b(immediately|asap|as soon as possible|urgent(ly)?|right away|this week|next week|this month|ready to (buy|move|proceed)|within (a|one|two|2|1) weeks?|straight away)\b/i],
  ["3_months", /\b(next month|(in|within) (the next )?(1|2|3|one|two|three|a couple of|a few) months?|this quarter|(60|90) days|by (the )?end of (next|this) month|in a month)\b/i],
  ["6_months", /\b((in|within) (the next )?(4|5|6|four|five|six) months|half a year|six months|by (the )?(summer|end of the year|year end|year-end)|later this year)\b/i],
  ["12_months", /\b(next year|within (a|one|the) year|(in|within) (12|twelve|nine|9) months|(in )?a year'?s? time|in a year)\b/i],
];

export function parseTimeline(text: string): Extraction["timeline"] {
  for (const [value, re] of TIMELINES) {
    const m = re.exec(text);
    if (m) return { value, evidence: clause(text, m.index) };
  }
  return null;
}

/** Common abbreviations agents and buyers use, mapped to the community's full name. */
const ALIASES: Record<string, string> = {
  jvc: "Jumeirah Village Circle",
  jvt: "Jumeirah Village Triangle",
  jlt: "Jumeirah Lake Towers",
  jbr: "Jumeirah Beach Residence",
  "the marina": "Dubai Marina",
  marina: "Dubai Marina",
  downtown: "Downtown Dubai",
  "business bay": "Business Bay",
  "palm jumeirah": "Palm Jumeirah",
  "the palm": "Palm Jumeirah",
  dubai_hills: "Dubai Hills Estate",
  "dubai hills": "Dubai Hills Estate",
  difc: "DIFC",
  saadiyat: "Saadiyat Island",
  "yas island": "Yas Island",
  yas: "Yas Island",
  "al reem": "Al Reem Island",
  reem: "Al Reem Island",
  bkc: "Bandra Kurla Complex",
  bandra: "Bandra West",
  worli: "Worli",
  "lower parel": "Lower Parel",
  powai: "Powai",
  juhu: "Juhu",
};

export function parseAreas(text: string, known: string[]): Extraction["areas"] {
  const lower = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, " ")} `;
  const found = new Map<string, number>();
  const sorted = [...new Set(known)].sort((a, b) => b.length - a.length);
  for (const name of sorted) {
    const n = name.toLowerCase();
    const i = lower.indexOf(` ${n} `);
    if (i >= 0 && ![...found.keys()].some((f) => f.toLowerCase().includes(n))) found.set(name, i);
  }
  for (const [alias, name] of Object.entries(ALIASES)) {
    const i = lower.indexOf(` ${alias.replace(/_/g, " ")} `);
    if (i < 0 || [...found.keys()].some((f) => f.toLowerCase() === name.toLowerCase() || f.toLowerCase().includes(alias))) continue;
    // Only map an alias to a community the firm works in, or to a well-known one when the firm list is empty.
    const match = sorted.find((k) => k.toLowerCase() === name.toLowerCase());
    if (match || !sorted.length) found.set(match ?? name, i);
  }
  if (!found.size) return null;
  const ordered = [...found.entries()].sort((a, b) => a[1] - b[1]).map(([n]) => n);
  return { value: ordered, evidence: clause(text, Math.max(0, [...found.values()].sort((a, b) => a - b)[0]! - 1)) };
}

export function parseBedrooms(text: string): Extraction["bedrooms"] {
  const studio = /\bstudio\b/i.exec(text);
  if (studio) return { value: 0, evidence: clause(text, studio.index) };
  const m = /\b(\d|one|two|three|four|five|six)\s*-?\s*(bed(room)?s?|br|bhk)\b/i.exec(text);
  if (!m) return null;
  const v = /\d/.test(m[1]!) ? Number(m[1]) : WORD_NUM[m[1]!.toLowerCase()]!;
  return { value: v, evidence: clause(text, m.index) };
}

const MOTIVATIONS: [Motivation, RegExp][] = [
  ["residency_visa", /\b(golden visa|residency|residence visa|investor visa|visa)\b/i],
  ["relocation", /\b(relocat\w*|moving to|transferr?ed|new job|posting|moving (here|back))\b/i],
  ["investment", /\b(invest\w*|rental (yield|income)|yield|roi|returns?|rent (it )?out|portfolio|capital (gain|appreciation)|buy[- ]to[- ]let|holiday home rental)\b/i],
  ["upsizing", /\b(bigger|more space|upgrad\w*|upsiz\w*|downsiz\w*|growing family|extra room)\b/i],
  ["end_use", /\b(to live|live in|living in|for (my|our) (family|own use|use)|for myself|own use|end use|end-use|move in|family home|primary residence|our home|my home|kids|children|school)\b/i],
];

export function parseMotivation(text: string): Extraction["motivation"] {
  for (const [value, re] of MOTIVATIONS) {
    const m = re.exec(text);
    if (m) return { value, evidence: clause(text, m.index) };
  }
  return null;
}

const FINANCING: [Financing, RegExp][] = [
  ["cash", /\b(cash( buyer| purchase| deal)?|no (mortgage|loan|finance)|without (a )?(mortgage|loan)|outright|fully funded|own funds)\b/i],
  ["mortgage_approved", /\b(pre-?approv\w*|approved (mortgage|loan|for a mortgage)|mortgage (approval|in principle)|approval in principle|aip|loan (is )?sanctioned|sanctioned (loan|home loan)|mortgage (is )?approved)\b/i],
  ["undecided", /\b(not sure (about|how|if)|undecided|haven'?t decided|depends on the (rate|bank)|exploring (mortgage|finance) options)\b/i],
  ["mortgage_needed", /\b(mortgage|home loan|financ(e|ing)|loan|emi|bank (loan|finance))\b/i],
];

export function parseFinancing(text: string): Extraction["financing"] {
  for (const [value, re] of FINANCING) {
    const m = re.exec(text);
    if (m) return { value, evidence: clause(text, m.index) };
  }
  return null;
}

const REQUESTS_AGENT = /\b(speak|talk|chat) (to|with) (an? )?(agent|person|human|someone|manager|broker|real person)|\b(call me|phone me|ring me|give me a call|can (someone|you) call|real person|human being|not a (bot|robot)|are you a (bot|robot))\b/i;
const COMPLAINT = /\b(complain\w*|unacceptable|disappointed|terrible|awful|scam|fraud|cheat\w*|refund|angry|worst|legal action|report you|misleading|harass\w*)\b/i;
const COMPLEX: [string, RegExp][] = [
  ["contract terms", /\b(contract|spa|sale and purchase agreement|form [abf]|mou|agreement terms|clause)\b/i],
  ["title and registration", /\b(title deed|oqood|noc|escrow|registration fee|land registry|mutation|7\/12|encumbrance)\b/i],
  ["tax", /\b(tax(es|ation)?|stamp duty|capital gains|vat|gst|tds|withholding)\b/i],
  ["cross-border funds", /\b(fema|repatriat\w*|nri account|nre|nro|transfer (money|funds) (abroad|overseas)|remit\w*)\b/i],
  ["legal authority", /\b(power of attorney|poa|probate|inheritance|will|divorce|court|lawyer|solicitor)\b/i],
];
const VIEWING = /\b(view(ing)?|visit|see (it|the (property|apartment|flat|villa|unit|place|home))|tour|show me|inspect\w*|come (by|over|and see)|available to see|open house)\b/i;
const DECLINES = /\b(not interested|no longer (interested|looking)|already (bought|found|rented|signed)|found (a|another) (place|property|home|flat)|remove me|unsubscribe|stop messaging|wrong number)\b/i;
const ORDINAL: Record<string, number> = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3 };

/** A slot choice: "2", "option 3", "the first one", or a weekday or time that matches exactly one offered slot. */
export function parseSlotChoice(text: string, slotLabels: string[]): number | null {
  if (!slotLabels.length) return null;
  const t = text.trim().toLowerCase();
  const digit = /^(?:option\s*|slot\s*|number\s*|#)?([1-9])\s*[.)]?\s*(please|thanks|thank you)?[.!]?$/.exec(t) ?? /\b(?:option|slot|number)\s*([1-9])\b/.exec(t);
  if (digit) {
    const n = Number(digit[1]);
    return n >= 1 && n <= slotLabels.length ? n : null;
  }
  const ord = /\b(first|1st|second|2nd|third|3rd)\b/.exec(t);
  if (ord && /\b(one|slot|option|time|works|please|is fine|suits|ok|okay)\b/.test(t)) {
    const n = ORDINAL[ord[1]!]!;
    return n <= slotLabels.length ? n : null;
  }
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const day = days.find((d) => t.includes(d));
  const time = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(t);
  const candidates = slotLabels
    .map((l, i) => ({ l: l.toLowerCase(), i }))
    .filter(({ l }) => (day ? l.includes(day) : true))
    .filter(({ l }) => {
      if (!time) return true;
      let h = Number(time[1]);
      if (time[3] === "pm" && h < 12) h += 12;
      if (time[3] === "am" && h === 12) h = 0;
      if (!time[3] && h < 8) h += 12;
      return l.includes(`${String(h).padStart(2, "0")}:${time[2] ?? "00"}`);
    });
  return (day || time) && candidates.length === 1 ? candidates[0]!.i + 1 : null;
}

export function extract(text: string, opts: { currency: string; areas: string[]; slots?: string[] }): Extraction {
  const complex = COMPLEX.find(([, re]) => re.test(text));
  return {
    budget: parseBudget(text, opts.currency),
    timeline: parseTimeline(text),
    areas: parseAreas(text, opts.areas),
    bedrooms: parseBedrooms(text),
    motivation: parseMotivation(text),
    financing: parseFinancing(text),
    intents: {
      requestsAgent: REQUESTS_AGENT.test(text),
      complaint: COMPLAINT.test(text),
      complexQuestion: complex ? complex[0] : null,
      wantsViewing: VIEWING.test(text),
      declines: DECLINES.test(text),
      slotChoice: parseSlotChoice(text, opts.slots ?? []),
    },
  };
}

/** Which qualification fields an extraction answers. */
export function answered(e: Extraction): QualField[] {
  const out: QualField[] = [];
  if (e.budget) out.push("budget");
  if (e.timeline) out.push("timeline");
  if (e.areas) out.push("area");
  if (e.motivation) out.push("motivation");
  if (e.financing) out.push("financing");
  return out;
}
