import type { FieldTransform, MigrationEntity } from "@/db/schema-production";
import { LEAD_SOURCES, MARKETS, type MarketCode } from "@/lib/markets";

/**
 * Field mapping for imports: the Nakhla fields a source record can fill, the
 * automatic mapping from source column names, and the transforms that turn
 * CRM values into clean records. Pure functions; the engine applies them.
 */

export type TargetField = { key: string; label: string; required?: boolean; transform: FieldTransform; aliases: string[]; hint?: string };

export const LEAD_FIELDS: TargetField[] = [
  { key: "name", label: "Full name", transform: "titlecase", aliases: ["name", "full name", "fullname", "contact name", "lead name", "client name", "display name"], hint: "Or map first and last name separately." },
  { key: "first_name", label: "First name", transform: "titlecase", aliases: ["first name", "firstname", "first", "given name", "fname", "properties.firstname"] },
  { key: "last_name", label: "Last name", transform: "titlecase", aliases: ["last name", "lastname", "last", "surname", "family name", "lname", "properties.lastname"] },
  { key: "email", label: "Email", transform: "lowercase", aliases: ["email", "email address", "e-mail", "primary email", "emails.0.value", "properties.email", "personemail"] },
  { key: "phone", label: "Phone", transform: "phone", aliases: ["phone", "mobile", "phone number", "mobile phone", "cell", "telephone", "primary phone", "phones.0.value", "properties.phone", "mobilephone", "whatsapp"] },
  { key: "source", label: "Source", transform: "value_map", aliases: ["source", "lead source", "leadsource", "origin", "channel", "properties.hs_analytics_source", "lead_source"] },
  { key: "stage", label: "Stage", transform: "value_map", aliases: ["stage", "status", "lead status", "lifecycle stage", "pipeline stage", "properties.hs_lead_status", "properties.lifecyclestage", "lead_status"] },
  { key: "intent", label: "Intent", transform: "value_map", aliases: ["intent", "type", "lead type", "contact type", "buyer or seller", "looking to", "pba__request_type__c"] },
  { key: "budget_max", label: "Budget, maximum", transform: "number", aliases: ["budget", "max budget", "budget max", "price", "max price", "price max", "maximum price", "price_max", "pba__maxprice__c"] },
  { key: "budget_min", label: "Budget, minimum", transform: "number", aliases: ["min budget", "budget min", "min price", "price min", "minimum price", "price_min", "pba__minprice__c"] },
  { key: "location", label: "Preferred areas", transform: "split_list", aliases: ["location", "area", "areas", "community", "neighbourhood", "neighborhood", "city", "preferred location", "pba__locations__c"] },
  { key: "property_type", label: "Property type", transform: "titlecase", aliases: ["property type", "type of property", "propertytype", "unit type", "pba__propertytype__c"] },
  { key: "timeline", label: "Timeline", transform: "value_map", aliases: ["timeline", "timeframe", "time frame", "move date", "purchase timeframe"] },
  { key: "message", label: "Notes", transform: "trim", aliases: ["message", "notes", "note", "comments", "description", "enquiry", "inquiry", "background"] },
  { key: "market", label: "Market (country)", transform: "value_map", aliases: ["market", "country", "mailing country", "address country"] },
  { key: "created_at", label: "Created on", transform: "date", aliases: ["created", "created at", "created date", "createddate", "date added", "created_at", "createdtime", "created_time", "createdate", "properties.createdate"] },
  { key: "external_id", label: "Source record ID", transform: "trim", aliases: ["id", "record id", "contact id", "lead id", "external id"] },
  { key: "consent_marketing", label: "Marketing consent", transform: "value_map", aliases: ["consent", "marketing consent", "opt in", "email opt in", "subscribed", "hasoptedoutofemail"] },
];

export const LISTING_FIELDS: TargetField[] = [
  { key: "title", label: "Title", required: true, transform: "trim", aliases: ["title", "name", "listing title", "headline", "pba__listing__c.name"] },
  { key: "purpose", label: "Sale or rent", transform: "value_map", aliases: ["purpose", "offering type", "listing type", "for", "transaction type", "pba__listingtype__c"] },
  { key: "property_type", label: "Property type", transform: "titlecase", aliases: ["property type", "type", "unit type", "category", "pba__propertytype__c"] },
  { key: "price", label: "Price", required: true, transform: "number", aliases: ["price", "asking price", "list price", "listing price", "rent", "pba__listingprice_pb__c"] },
  { key: "city", label: "City", required: true, transform: "titlecase", aliases: ["city", "emirate", "town", "pba__city_pb__c"] },
  { key: "community", label: "Community", transform: "titlecase", aliases: ["community", "area", "neighbourhood", "neighborhood", "location", "district", "sub community", "pba__area_pb__c"] },
  { key: "bedrooms", label: "Bedrooms", transform: "number", aliases: ["bedrooms", "beds", "bed", "br", "pba__bedrooms_pb__c"] },
  { key: "bathrooms", label: "Bathrooms", transform: "number", aliases: ["bathrooms", "baths", "bath", "pba__fullbathrooms_pb__c"] },
  { key: "area", label: "Area", required: true, transform: "number", aliases: ["area", "size", "built up area", "bua", "sqft", "square feet", "size sqft", "pba__totalarea_pb__c"] },
  { key: "permit", label: "Permit or registration", transform: "trim", aliases: ["permit", "permit number", "trakheesi", "rera", "rera number", "rera permit", "madmoun", "adrec"] },
  { key: "description", label: "Description", transform: "trim", aliases: ["description", "details", "remarks", "public remarks", "pba__description_pb__c"] },
  { key: "status", label: "Status", transform: "value_map", aliases: ["status", "listing status", "pba__status__c"] },
  { key: "market", label: "Market (country)", transform: "value_map", aliases: ["market", "country", "pba__country_pb__c"] },
  { key: "external_id", label: "Source reference", transform: "trim", aliases: ["id", "reference", "ref", "listing id", "listing reference", "mls", "mls number"] },
];

export const fieldsFor = (entity: MigrationEntity) => (entity === "listings" ? LISTING_FIELDS : LEAD_FIELDS);

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/__c$/, "")
    .replace(/[_\-.]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Proposes a mapping: exact alias matches first, then containment, each source column used once. */
export function autoMap(entity: MigrationEntity, sourceFields: string[]): { sourceField: string; targetField: string; transform: FieldTransform }[] {
  const out: { sourceField: string; targetField: string; transform: FieldTransform }[] = [];
  const used = new Set<string>();
  const targets = fieldsFor(entity);
  for (const pass of ["exact", "contains"] as const) {
    for (const t of targets) {
      if (out.some((o) => o.targetField === t.key)) continue;
      const aliases = t.aliases.map(norm);
      const hit = sourceFields.find((f) => {
        if (used.has(f)) return false;
        const n = norm(f);
        return pass === "exact" ? aliases.includes(n) : aliases.some((a) => a.length > 3 && (n.includes(a) || (n.length > 3 && a.includes(n))));
      });
      if (hit) {
        used.add(hit);
        out.push({ sourceField: hit, targetField: t.key, transform: t.transform });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------- transforms */

const DIAL: Record<MarketCode, string> = { AE: "971", IN: "91", GB: "44", SG: "65", AU: "61", US: "1" };

/** E.164 from local or international formats; the market's dialling code fills in a missing country code. */
export function normalisePhone(raw: string, market: MarketCode = "AE"): string | null {
  const v = raw.trim();
  if (!v) return null;
  const plus = v.startsWith("+") || v.startsWith("00");
  let d = v.replace(/^00/, "").replace(/\D+/g, "");
  if (!plus) {
    const code = DIAL[market];
    if (d.startsWith(code) && d.length > code.length + 7) {
      // already carries the country code without a plus
    } else d = code + d.replace(/^0+/, "");
  }
  return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
}

/** Numbers as CRMs export them: currency symbols, thousands separators, k/M/B, lakh (L) and crore (Cr). */
export function parseAmount(raw: string): number | null {
  const v = raw.trim().toLowerCase().replace(/,/g, "");
  if (!v) return null;
  const m = v.match(/(-?\d+(?:\.\d+)?)\s*(k|m|mn|million|b|bn|l|lac|lakh|lakhs|cr|crore|crores)?\b/);
  if (!m) return null;
  const n = Number(m[1]);
  const mult: Record<string, number> = { k: 1e3, m: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, crores: 1e7 };
  const out = n * (m[2] ? mult[m[2]]! : 1);
  return Number.isFinite(out) ? out : null;
}

/** ISO dates, epoch seconds or milliseconds, and day-first or month-first slashed dates (day-first unless impossible). */
export function parseDate(raw: string): Date | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^\d{10}$/.test(v)) return new Date(Number(v) * 1000);
  if (/^\d{13}$/.test(v)) return new Date(Number(v));
  const s = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (s) {
    let [a, b] = [Number(s[1]), Number(s[2])];
    const y = Number(s[3]!.length === 2 ? `20${s[3]}` : s[3]);
    if (b > 12 && a <= 12) [a, b] = [b, a];
    if (a > 31 || b > 12) return null;
    const d = new Date(Date.UTC(y, b - 1, a, Number(s[4] ?? 0), Number(s[5] ?? 0)));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const titleCase = (v: string) => (v === v.toUpperCase() || v === v.toLowerCase() ? v.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase()) : v);

/** Vocabulary each CRM uses for the same idea, mapped onto Nakhla's values. Custom value maps take precedence. */
const VOCAB: Record<string, Record<string, string[]>> = {
  stage: {
    new: ["new", "lead", "open", "unassigned", "new lead", "subscriber", "fresh"],
    contacted: ["contacted", "attempted", "attempted to contact", "working", "in progress", "nurture", "connected", "warm", "open deal"],
    qualified: ["qualified", "hot", "hot prospect", "prospect", "active", "active client", "sales qualified lead", "marketing qualified lead", "sql", "mql", "opportunity"],
    viewing: ["viewing", "showing", "appointment", "appointment set", "met", "met with", "viewing booked"],
    offer: ["offer", "negotiation", "under contract", "pending", "offer made", "contract sent"],
    won: ["won", "closed", "closed won", "sold", "client", "customer", "past client", "converted"],
    lost: ["lost", "closed lost", "dead", "junk", "trash", "archived", "unresponsive", "unqualified", "bad timing", "not interested", "do not contact"],
  },
  intent: {
    buy: ["buy", "buyer", "purchase", "purchaser"],
    rent: ["rent", "renter", "tenant", "lease", "leasing"],
    sell: ["sell", "seller", "vendor", "listing"],
    let: ["let", "landlord", "letting", "owner"],
    invest: ["invest", "investor", "investment"],
  },
  timeline: {
    immediate: ["immediate", "immediately", "asap", "now", "0-1 months", "this month", "0-3 months"],
    "3_months": ["3 months", "1-3 months", "within 3 months", "3m", "next quarter"],
    "6_months": ["6 months", "3-6 months", "within 6 months", "6m"],
    "12_months": ["12 months", "6-12 months", "within a year", "1 year", "12m"],
    exploring: ["exploring", "just looking", "not sure", "unknown", "12+ months", "researching"],
  },
  purpose: { sale: ["sale", "sell", "for sale", "buy", "residential sale", "commercial sale"], rent: ["rent", "for rent", "let", "lease", "to let", "residential rent", "rental"] },
  status: {
    active: ["active", "available", "published", "live", "on market", "for sale", "for rent"],
    draft: ["draft", "coming soon", "pre-market", "inactive", "pending approval"],
    under_offer: ["under offer", "under contract", "reserved", "pending", "sale agreed", "let agreed"],
    sold: ["sold", "closed", "completed"],
    let: ["let", "rented", "leased"],
    withdrawn: ["withdrawn", "expired", "off market", "cancelled", "archived"],
  },
  market: {
    AE: ["ae", "uae", "united arab emirates", "dubai", "abu dhabi", "sharjah"],
    IN: ["in", "india", "mumbai", "bengaluru", "bangalore", "delhi", "goa", "pune"],
    GB: ["gb", "uk", "united kingdom", "england", "scotland", "wales", "london"],
    SG: ["sg", "singapore"],
    AU: ["au", "australia", "sydney", "melbourne"],
    US: ["us", "usa", "united states", "united states of america"],
  },
  consent_marketing: { true: ["yes", "true", "1", "y", "opted in", "subscribed"], false: ["no", "false", "0", "n", "opted out", "unsubscribed"] },
};

const SOURCE_ALIASES: Record<string, string[]> = {
  website: ["website", "web", "web form", "organic search", "direct traffic", "seo", "organic", "idx"],
  referral: ["referral", "referred", "sphere", "past client", "friend"],
  walk_in: ["walk in", "walk-in", "call", "phone", "phone call", "inbound call", "sign call", "open house"],
  whatsapp: ["whatsapp", "wa"],
  meta_ads: ["facebook", "facebook ads", "instagram", "meta", "paid social", "social media"],
  google_ads: ["google", "google ads", "ppc", "paid search", "adwords"],
};

export function mapVocabulary(field: string, raw: string, custom: Record<string, string> = {}): string | null {
  const v = raw.trim();
  if (!v) return null;
  const lower = v.toLowerCase();
  for (const [k, out] of Object.entries(custom)) if (k.toLowerCase() === lower) return out;
  if (field === "source") {
    const n = norm(v);
    const portal = LEAD_SOURCES.find((s) => norm(s.name) === n || s.key === n.replace(/ /g, ""));
    if (portal) return portal.key;
    for (const [key, aliases] of Object.entries(SOURCE_ALIASES)) if (aliases.includes(n)) return key;
    return n.replace(/ /g, "_").slice(0, 40) || null;
  }
  const vocab = VOCAB[field];
  if (!vocab) return v;
  for (const [key, aliases] of Object.entries(vocab)) if (aliases.includes(lower) || key.toLowerCase() === lower) return key;
  return null;
}

export function applyTransform(transform: FieldTransform, field: string, raw: string | undefined, ctx: { market: MarketCode; valueMap?: Record<string, string> }): unknown {
  const v = (raw ?? "").trim();
  if (!v) return null;
  switch (transform) {
    case "none":
      return raw ?? null;
    case "trim":
      return v.replace(/\s+/g, " ");
    case "lowercase":
      return v.toLowerCase();
    case "titlecase":
      return titleCase(v.replace(/\s+/g, " "));
    case "phone":
      return normalisePhone(v, ctx.market);
    case "number":
      return parseAmount(v);
    case "date":
      return parseDate(v);
    case "split_list":
      return v
        .split(/[;,|/]+/)
        .map((x) => titleCase(x.trim()))
        .filter(Boolean);
    case "value_map":
      return mapVocabulary(field, v, ctx.valueMap);
  }
}

/* --------------------------------------------------------- record building */

export type MappingRule = { sourceField: string; targetField: string; transform: FieldTransform; valueMap?: Record<string, string> };

export type LeadDraft = {
  name: string;
  email: string | null;
  phone: string | null;
  source: string;
  stage: "new" | "contacted" | "qualified" | "viewing" | "offer" | "won" | "lost";
  intent: "buy" | "rent" | "sell" | "let" | "invest";
  market: MarketCode;
  budgetMin: number | null;
  budgetMax: number | null;
  locations: string[];
  propertyType: string | null;
  timeline: "immediate" | "3_months" | "6_months" | "12_months" | "exploring";
  message: string | null;
  createdAt: Date | null;
  externalId: string | null;
  consentMarketing: boolean;
};

export type ListingDraft = {
  title: string;
  purpose: "sale" | "rent";
  propertyType: string;
  price: number;
  city: string;
  community: string;
  bedrooms: number | null;
  bathrooms: number | null;
  area: number;
  permit: string | null;
  description: string;
  status: "draft" | "active" | "under_offer" | "sold" | "let" | "withdrawn";
  market: MarketCode;
  externalId: string | null;
};

export type BuildResult<T> = { ok: true; record: T; warnings: string[] } | { ok: false; errors: string[]; warnings: string[] };

function collect(rules: MappingRule[], row: Record<string, string>, defaultMarket: MarketCode) {
  const marketRule = rules.find((r) => r.targetField === "market");
  const market = ((marketRule && (applyTransform(marketRule.transform, "market", row[marketRule.sourceField], { market: defaultMarket, valueMap: marketRule.valueMap }) as string | null)) || defaultMarket) as MarketCode;
  const values: Record<string, unknown> = { market: MARKETS[market] ? market : defaultMarket };
  const warnings: string[] = [];
  for (const r of rules) {
    if (r.targetField === "market") continue;
    const raw = row[r.sourceField];
    const out = applyTransform(r.transform, r.targetField, raw, { market: values.market as MarketCode, valueMap: r.valueMap });
    if (raw?.trim() && (out === null || (Array.isArray(out) && !out.length))) warnings.push(`${r.sourceField}: "${raw.trim().slice(0, 60)}" could not be read as ${r.targetField.replace(/_/g, " ")}`);
    if (out !== null && out !== undefined) values[r.targetField] = out;
  }
  return { values, warnings };
}

export function buildLead(rules: MappingRule[], row: Record<string, string>, defaultMarket: MarketCode, fallbackSource: string): BuildResult<LeadDraft> {
  const { values: v, warnings } = collect(rules, row, defaultMarket);
  const name = (v.name as string | undefined) ?? [v.first_name, v.last_name].filter(Boolean).join(" ");
  const errors: string[] = [];
  const email = (v.email as string | undefined) ?? null;
  const validEmail = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
  if (email && !validEmail) warnings.push(`email: "${email}" is not a valid address and was left blank`);
  const phone = (v.phone as string | undefined) ?? null;
  if (!name.trim()) errors.push("No name: map a full name, or first and last name.");
  if (!validEmail && !phone) errors.push("No usable email address or phone number.");
  if (errors.length) return { ok: false, errors, warnings };
  const consent = v.consent_marketing as string | undefined;
  // Salesforce exports the negative flag HasOptedOutOfEmail; true there means no consent.
  const optOutColumn = rules.find((r) => r.targetField === "consent_marketing")?.sourceField.toLowerCase().includes("optedout");
  return {
    ok: true,
    warnings,
    record: {
      name: name.trim().slice(0, 160),
      email: validEmail,
      phone,
      source: (v.source as string | undefined) ?? fallbackSource,
      stage: ((v.stage as string | undefined) ?? "new") as LeadDraft["stage"],
      intent: ((v.intent as string | undefined) ?? "buy") as LeadDraft["intent"],
      market: v.market as MarketCode,
      budgetMin: (v.budget_min as number | undefined) ?? null,
      budgetMax: (v.budget_max as number | undefined) ?? null,
      locations: (v.location as string[] | undefined) ?? [],
      propertyType: (v.property_type as string | undefined) ?? null,
      timeline: ((v.timeline as string | undefined) ?? "exploring") as LeadDraft["timeline"],
      message: ((v.message as string | undefined) ?? null)?.slice(0, 2000) ?? null,
      createdAt: (v.created_at as Date | undefined) ?? null,
      externalId: (v.external_id as string | undefined) ?? null,
      consentMarketing: consent === undefined ? false : optOutColumn ? consent === "false" : consent === "true",
    },
  };
}

export function buildListing(rules: MappingRule[], row: Record<string, string>, defaultMarket: MarketCode): BuildResult<ListingDraft> {
  const { values: v, warnings } = collect(rules, row, defaultMarket);
  const errors: string[] = [];
  for (const f of LISTING_FIELDS.filter((x) => x.required)) if (v[f.key] === undefined || v[f.key] === null || v[f.key] === "") errors.push(`${f.label} is missing.`);
  if (typeof v.price === "number" && v.price <= 0) errors.push("Price must be above zero.");
  if (errors.length) return { ok: false, errors, warnings };
  return {
    ok: true,
    warnings,
    record: {
      title: String(v.title).slice(0, 200),
      purpose: ((v.purpose as string | undefined) ?? "sale") as ListingDraft["purpose"],
      propertyType: (v.property_type as string | undefined) ?? "Apartment",
      price: v.price as number,
      city: v.city as string,
      community: (v.community as string | undefined) ?? (v.city as string),
      bedrooms: v.bedrooms === undefined ? null : Math.round(v.bedrooms as number),
      bathrooms: v.bathrooms === undefined ? null : Math.round(v.bathrooms as number),
      area: v.area as number,
      permit: (v.permit as string | undefined) ?? null,
      description: (v.description as string | undefined) ?? "",
      status: ((v.status as string | undefined) ?? "draft") as ListingDraft["status"],
      market: v.market as MarketCode,
      externalId: (v.external_id as string | undefined) ?? null,
    },
  };
}

/** Identity used for de-duplication against existing leads and within the import itself. */
export const leadKeys = (l: { email: string | null; phone: string | null }) => [l.email ? `e:${l.email.toLowerCase()}` : null, l.phone ? `p:${l.phone.replace(/\D/g, "")}` : null].filter((x): x is string => Boolean(x));

/** The values a mapped vocabulary field can take, for the value-map editor. */
export function valueOptions(field: string): { value: string; label: string }[] {
  if (field === "source") return LEAD_SOURCES.map((s) => ({ value: s.key, label: s.name }));
  if (field === "market") return Object.values(MARKETS).map((m) => ({ value: m.code, label: m.name }));
  const vocab = VOCAB[field];
  if (!vocab) return [];
  return Object.keys(vocab).map((k) => ({ value: k, label: k === "true" ? "Consented" : k === "false" ? "No consent" : k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) }));
}
