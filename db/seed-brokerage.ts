import { sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { LeadIntent, LeadStage, LeadTimeline } from "@/db/schema-brokerage";
import { scoreLead } from "@/lib/brokerage/scoring";
import { rentSchedule } from "@/lib/brokerage/rentals-schedule";
import { MARKETS, type MarketCode, permitLabel, SOURCE_NAME } from "@/lib/markets";

const DAY = 86_400_000;
const HOUR = 3_600_000;

interface Target {
  tenantId: string;
  slug: string;
  staff: boolean;
  id: (key: string) => string;
  adminUserId?: string;
}

type ListingSeed = { key: string; title: string; city: string; community: string; type: string; purpose: "sale" | "rent"; price: number; beds: number | null; baths: number | null; area: number; permit: string | null; status: "draft" | "active" | "under_offer" | "sold" | "let"; features: string[]; portals: string[]; ownerClient?: string };

const UAE_LISTINGS: ListingSeed[] = [
  { key: "marina-gate", title: "Two-bedroom apartment, Marina Gate 2", city: "Dubai", community: "Dubai Marina", type: "Apartment", purpose: "sale", price: 2_400_000, beds: 2, baths: 3, area: 1280, permit: "7120345611", status: "active", features: ["Balcony with marina view", "Covered parking", "Gym", "Pool", "Concierge"], portals: ["bayut", "propertyfinder", "dubizzle"] },
  { key: "dubai-hills-villa", title: "Four-bedroom villa, Maple 2, Dubai Hills Estate", city: "Dubai", community: "Dubai Hills Estate", type: "Villa", purpose: "sale", price: 6_850_000, beds: 4, baths: 5, area: 3140, permit: "7120397822", status: "active", features: ["Private garden", "Maid's room", "Two covered parking spaces", "Park-facing"], portals: ["bayut", "propertyfinder"], ownerClient: "khalid" },
  { key: "downtown-1br", title: "One-bedroom apartment, Burj Royale", city: "Dubai", community: "Downtown Dubai", type: "Apartment", purpose: "rent", price: 135_000, beds: 1, baths: 2, area: 780, permit: "7120411045", status: "active", features: ["Burj Khalifa view", "Chiller-free", "Gym", "Pool"], portals: ["bayut", "propertyfinder", "dubizzle"] },
  { key: "saadiyat-grove", title: "Four-bedroom villa, Saadiyat Grove", city: "Abu Dhabi", community: "Saadiyat Island", type: "Villa", purpose: "sale", price: 12_400_000, beds: 4, baths: 5, area: 4210, permit: "AD-20260418-0331", status: "active", features: ["Off-plan, handover Q4 2027", "Private pool", "Aldar master community", "Payment plan 60/40"], portals: ["bayut", "propertyfinder"] },
  { key: "jvc-studio", title: "Studio apartment, Binghatti Gems, JVC", city: "Dubai", community: "Jumeirah Village Circle", type: "Apartment", purpose: "rent", price: 58_000, beds: 0, baths: 1, area: 410, permit: "7120422190", status: "let", features: ["Furnished", "Pool", "Covered parking"], portals: ["dubizzle"] },
  { key: "yas-townhouse", title: "Three-bedroom townhouse, Yas Acres", city: "Abu Dhabi", community: "Yas Island", type: "Townhouse", purpose: "sale", price: 3_950_000, beds: 3, baths: 4, area: 2380, permit: "AD-20260302-0118", status: "under_offer", features: ["Golf course access", "Landscaped garden", "Community pool"], portals: ["bayut", "propertyfinder"], ownerClient: "fatima" },
  { key: "business-bay-office", title: "Fitted office, Bay Square", city: "Dubai", community: "Business Bay", type: "Office", purpose: "rent", price: 260_000, beds: null, baths: 2, area: 1650, permit: null, status: "draft", features: ["Fitted with partitions", "Two parking spaces"], portals: [] },
  { key: "palm-penthouse", title: "Penthouse, Atlantis The Royal Residences", city: "Dubai", community: "Palm Jumeirah", type: "Penthouse", purpose: "sale", price: 38_000_000, beds: 5, baths: 6, area: 9600, permit: "7120310055", status: "sold", features: ["Private pool terrace", "Hotel services", "Sea view"], portals: ["propertyfinder"] },
];

const INDIA_LISTINGS: ListingSeed[] = [
  { key: "worli-3bhk", title: "Three-bedroom residence, Lodha Park, Worli", city: "Mumbai", community: "Worli", type: "Apartment", purpose: "sale", price: 86_000_000, beds: 3, baths: 3, area: 1650, permit: "P51900002345", status: "active", features: ["Sea and park view", "Two car parks", "Clubhouse", "Ready possession"], portals: ["magicbricks", "99acres", "housing"] },
  { key: "bandra-2bhk", title: "Two-bedroom apartment, Rustomjee Seasons, Bandra East", city: "Mumbai", community: "Bandra East", type: "Apartment", purpose: "sale", price: 41_500_000, beds: 2, baths: 2, area: 905, permit: "P51800009876", status: "active", features: ["Carpet area 905 sq ft", "Covered parking", "Near BKC"], portals: ["magicbricks", "99acres"] },
  { key: "powai-rent", title: "Two-bedroom apartment for leave and licence, Hiranandani Gardens", city: "Mumbai", community: "Powai", type: "Apartment", purpose: "rent", price: 95_000, beds: 2, baths: 2, area: 1050, permit: "P51800004412", status: "active", features: ["Semi-furnished", "Lake view", "Covered parking"], portals: ["99acres", "housing"] },
  { key: "assagao-villa", title: "Four-bedroom villa, Assagao", city: "Goa", community: "Assagao", type: "Villa", purpose: "sale", price: 72_500_000, beds: 4, baths: 5, area: 4200, permit: "PRGO04230987", status: "active", features: ["Private pool", "Portuguese-style courtyard", "Settlement zone"], portals: ["magicbricks", "housing"], ownerClient: "rajesh" },
  { key: "siolim-2bhk", title: "Two-bedroom serviced apartment, Siolim", city: "Goa", community: "Siolim", type: "Apartment", purpose: "sale", price: 14_800_000, beds: 2, baths: 2, area: 1120, permit: "PRGO07221456", status: "under_offer", features: ["Rental pool programme", "Shared pool"], portals: ["99acres"] },
  { key: "thane-3bhk", title: "Three-bedroom apartment, Hiranandani Estate, Thane", city: "Thane", community: "Ghodbunder Road", type: "Apartment", purpose: "sale", price: 24_000_000, beds: 3, baths: 3, area: 1380, permit: null, status: "draft", features: ["Township amenities"], portals: [] },
];

const UAE_NAMES = ["Rahul Khanna", "Sarah Whitfield", "Omar Al Suwaidi", "Elena Petrova", "Hassan Qureshi", "Mei Lin Tan", "James O'Connor", "Noura Al Mazrouei", "Vikram Shah", "Laura Martinez", "Karim Haddad", "Anika Rao", "David Cohen", "Fatma Yilmaz", "Arjun Pillai", "Chloe Dubois", "Sultan Al Falasi", "Grace Okafor"];
const INDIA_NAMES = ["Neha Kulkarni", "Aditya Joshi", "Sameer Deshpande", "Kavya Menon", "Rohit Bhatia", "Ishita Gupta", "Farhan Sheikh", "Pooja Naik", "Anand Iyer", "Meera Fernandes", "Siddharth Rane", "Tanvi Shetty", "Karan Malhotra", "Riya D'Souza"];

const STAGES: LeadStage[] = ["new", "new", "contacted", "contacted", "qualified", "qualified", "viewing", "viewing", "offer", "won", "lost", "contacted", "new", "qualified", "viewing", "won", "lost", "contacted"];
const TIMELINES: LeadTimeline[] = ["immediate", "3_months", "3_months", "6_months", "12_months", "exploring"];
const LOST = ["Bought through another agency", "Budget below the market for the brief", "Paused the search"];

/**
 * Brokerage module data: listings with syndication, leads with activity and
 * scores, campaigns, offices and targets, recruiting, tenancies with rent and
 * maintenance, and referrals. Deterministic ids; inserts skip existing rows,
 * so it also upgrades workspaces seeded before these modules existed.
 */
export async function seedBrokerage(db: DB, t: Target, now = Date.now()) {
  const india = t.slug === "bombay";
  const m = MARKETS[(india ? "IN" : "AE") as MarketCode];
  const staffKeys = t.staff ? ["aisha", "rohan", "amol"] : [];
  const staff = t.staff ? staffKeys.map((k) => t.id(`user:${k}`)) : t.adminUserId ? [t.adminUserId] : [];
  const pick = <T,>(arr: T[], i: number) => arr[i % arr.length]!;
  const owner = (i: number) => (staff.length ? pick(staff, i) : null);
  const client = (k: string) => t.id(`client:${k}`);

  /* listings */
  const listingSeeds = india ? INDIA_LISTINGS : UAE_LISTINGS;
  const listingRows = listingSeeds.map((l, i) => ({
    id: t.id(`listing:${l.key}`),
    tenantId: t.tenantId,
    reference: `LS-${String(i + 1).padStart(4, "0")}`,
    title: l.title,
    market: m.code,
    city: l.city,
    community: l.community,
    propertyType: l.type,
    purpose: l.purpose,
    status: l.status,
    price: l.price,
    currency: m.currency,
    rentPeriod: l.purpose === "rent" ? (india ? ("monthly" as const) : ("annual" as const)) : null,
    bedrooms: l.beds,
    bathrooms: l.baths,
    area: l.area,
    areaUnit: m.areaUnit,
    permitNumber: l.permit,
    description:
      l.status === "draft"
        ? ""
        : `A ${l.beds ? `${l.beds}-bedroom` : ""} ${l.type.toLowerCase()} of ${l.area.toLocaleString("en-US")} sq ft in ${l.community}, ${l.city}, offered ${l.purpose === "sale" ? "for sale" : "to let"}.\n\nThe home and building provide ${l.features.map((f) => f.toLowerCase()).join(", ")}.\n\nViewings are by appointment.${l.permit ? ` ${permitLabel(m.code, l.city)}: ${l.permit}.` : ""}`.replace("A  ", "A "),
    descriptionSource: (i % 2 ? "ai" : "manual") as "ai" | "manual",
    features: l.features,
    photos: l.status === "draft" ? [] : ["Living room", "Kitchen", "Principal bedroom", "Bathroom", "View", "Building exterior"].map((c, k) => ({ url: `${t.tenantId}/listings/${l.key}/${String(k + 1).padStart(2, "0")}.jpg`, caption: c })),
    virtualTourUrl: i % 3 === 0 && l.status !== "draft" ? `https://my.matterport.com/show/?m=${l.key}` : null,
    agentUserId: owner(i),
    ownerName: l.ownerClient ? null : india ? "Private owner" : "Private owner",
    ownerClientId: l.ownerClient ? client(l.ownerClient) : null,
    listedAt: l.status === "draft" ? null : new Date(now - (20 + i * 9) * DAY),
    views: l.status === "draft" ? 0 : 180 + ((i * 137) % 900),
    createdAt: new Date(now - (24 + i * 9) * DAY),
  }));
  await db.insert(s.listings).values(listingRows).onConflictDoNothing();
  const synd = listingSeeds.flatMap((l) =>
    l.portals.map((p) => ({
      id: t.id(`synd:${l.key}:${p}`),
      tenantId: t.tenantId,
      listingId: t.id(`listing:${l.key}`),
      portal: p,
      status: (l.status === "active" ? "live" : "paused") as "live" | "paused",
      externalRef: `${p.slice(0, 2).toUpperCase()}-${(l.key.length * 7919 + p.length * 104729).toString().slice(0, 7)}`,
      lastSyncedAt: new Date(now - 3 * HOUR),
      issue: l.status === "active" ? null : `Listing is ${l.status.replace("_", " ")}.`,
    })),
  );
  if (synd.length) await db.insert(s.listingSyndications).values(synd).onConflictDoNothing();

  /* leads */
  const names = india ? INDIA_NAMES : UAE_NAMES;
  const active = listingSeeds.filter((l) => l.status === "active" || l.status === "under_offer");
  const leadRows: (typeof s.leads.$inferInsert)[] = [];
  const acts: (typeof s.leadActivities.$inferInsert)[] = [];
  names.forEach((name, i) => {
    const l = i % 4 === 3 ? null : pick(active, i);
    const intent: LeadIntent = l ? (l.purpose === "rent" ? "rent" : i % 5 === 0 ? "invest" : "buy") : pick<LeadIntent>(["sell", "let", "buy"], i);
    const stage = STAGES[i % STAGES.length]!;
    const timeline = pick(TIMELINES, i + (stage === "viewing" || stage === "offer" ? 0 : 1));
    const created = now - (1 + ((i * 5) % 40)) * DAY - i * HOUR;
    const contacted = stage === "new" ? null : created + (2 + (i % 5)) * HOUR;
    const lastContact = contacted ? Math.min(now - HOUR, contacted + ((i * 3) % 12) * DAY) : null;
    const source = l ? pick(l.portals.length ? l.portals : ["website"], i) : pick(["website", "referral", "walk_in", "whatsapp", "meta_ads"], i);
    const budgetMax = l ? Math.round(l.price * (0.85 + ((i * 7) % 30) / 100)) : i % 3 ? null : india ? 30_000_000 : 3_500_000;
    const phone = india ? `+9198${String(20_000_000 + i * 7_313_131).slice(0, 8)}` : `+97150${String(1_000_000 + i * 731_313).slice(0, 7)}`;
    const email = i % 6 === 5 ? null : `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com`;
    const engagements = stage === "viewing" || stage === "offer" ? 3 : stage === "qualified" ? 2 : stage === "contacted" ? 1 : 0;
    const scored = scoreLead({ email, phone: i % 7 === 6 ? null : phone, intent, timeline, source, budgetMin: null, budgetMax, listingPrice: l?.price ?? null, recentEngagements: lastContact && now - lastContact < 14 * DAY ? engagements : 0, daysSinceContact: lastContact ? Math.floor((now - lastContact) / DAY) : null, daysSinceCreated: Math.floor((now - created) / DAY) });
    const id = t.id(`lead:${i}`);
    leadRows.push({
      id,
      tenantId: t.tenantId,
      reference: `LD-${String(i + 1).padStart(4, "0")}`,
      name,
      email,
      phone: i % 7 === 6 ? null : phone,
      source,
      market: m.code,
      intent,
      propertyType: l?.type ?? (intent === "sell" || intent === "let" ? "Apartment" : null),
      budgetMax,
      currency: m.currency,
      locations: l ? [l.community] : [india ? "Bandra West" : "Dubai Hills Estate"],
      timeline,
      stage,
      score: scored.score,
      scoreFactors: scored.factors,
      ownerUserId: owner(i),
      listingId: l ? t.id(`listing:${l.key}`) : null,
      message: l ? pick(["Is this still available, and can I view it this week?", "What is the service charge, and is parking included?", "Please share the floor plan and payment plan.", "Is the price negotiable for a cash buyer?"], i) : intent === "sell" ? "I would like a valuation of my apartment before listing it." : intent === "let" ? "Looking for an agent to let and manage my unit." : "Looking for a family home within the stated budget.",
      lastContactAt: lastContact ? new Date(lastContact) : null,
      nextAction: stage === "won" || stage === "lost" ? null : stage === "new" ? "First contact" : stage === "viewing" ? "Collect viewing feedback" : stage === "offer" ? "Chase the vendor's response" : "Confirm financing and book a viewing",
      nextActionAt: stage === "won" || stage === "lost" ? null : new Date(now + ((i % 4) - 1) * DAY),
      lostReason: stage === "lost" ? pick(LOST, i) : null,
      consentMarketing: i % 3 !== 1,
      createdAt: new Date(created),
      updatedAt: new Date(lastContact ?? created),
    });
    acts.push({ id: t.id(`lead-act:${i}:0`), tenantId: t.tenantId, leadId: id, type: "inbound", summary: `Enquiry via ${SOURCE_NAME[source] ?? source}`, occurredAt: new Date(created) });
    if (contacted) acts.push({ id: t.id(`lead-act:${i}:1`), tenantId: t.tenantId, leadId: id, type: i % 2 ? "whatsapp" : "call", summary: i % 2 ? "WhatsApp: sent floor plan and asked about timeline" : "Call: confirmed budget and preferred communities", outcome: "Responded", userId: owner(i), occurredAt: new Date(contacted) });
    if (["viewing", "offer", "won"].includes(stage)) acts.push({ id: t.id(`lead-act:${i}:2`), tenantId: t.tenantId, leadId: id, type: "viewing", summary: `Viewing of ${l?.title ?? "shortlisted homes"}`, outcome: stage === "viewing" ? "Interested; comparing two options" : "Positive; asked for offer guidance", userId: owner(i), occurredAt: new Date(lastContact ?? created) });
    if (stage === "lost") acts.push({ id: t.id(`lead-act:${i}:3`), tenantId: t.tenantId, leadId: id, type: "stage", summary: `Moved to Lost: ${pick(LOST, i)}`, userId: owner(i), occurredAt: new Date(lastContact ?? created) });
  });
  await db.insert(s.leads).values(leadRows).onConflictDoNothing();
  await db.insert(s.leadActivities).values(acts).onConflictDoNothing();

  /* campaigns */
  const cur = m.currency;
  await db
    .insert(s.campaigns)
    .values([
      { id: t.id("campaign:new-listings"), tenantId: t.tenantId, name: "New listings, this fortnight", channel: "email", status: "sent", segment: "buyers", subject: india ? "Three new homes in Worli, Bandra and Assagao" : "New this fortnight: Marina Gate and Dubai Hills", body: "Dear client,\n\nThree homes we have taken on in the last fortnight, before they are advertised more widely. Reply to arrange a viewing or to receive the floor plan.\n\nUnsubscribe at any time from the link below.", bodySource: "ai", sentAt: new Date(now - 12 * DAY), metrics: { audience: 11, sent: 10, opened: 6, clicked: 3, leads: 2 }, createdBy: owner(0), createdAt: new Date(now - 13 * DAY) },
      { id: t.id("campaign:valuation"), tenantId: t.tenantId, name: "Owner valuation offer", channel: "email", status: "sent", segment: "owners", subject: "What your home would achieve today", body: "Dear client,\n\nRecent transactions in your community have moved. We will prepare a written valuation from registered transactions, at no cost and with no obligation to list.\n\nUnsubscribe at any time from the link below.", bodySource: "manual", sentAt: new Date(now - 30 * DAY), metrics: { audience: 4, sent: 4, opened: 3, clicked: 1, leads: 1 }, createdBy: owner(1), createdAt: new Date(now - 31 * DAY) },
      { id: t.id("campaign:launch"), tenantId: t.tenantId, name: india ? "Assagao villa launch" : "Saadiyat Grove launch", channel: "social", status: "completed", segment: "hot", listingId: t.id(`listing:${india ? "assagao-villa" : "saadiyat-grove"}`), body: india ? "Four-bedroom villa in Assagao with a private pool and courtyard. Viewings by appointment." : "Four-bedroom villas at Saadiyat Grove, handover Q4 2027. Viewings by appointment.", bodySource: "ai", budget: india ? 150_000 : 12_000, currency: cur, sentAt: new Date(now - 21 * DAY), metrics: { audience: 5400, sent: 5400, opened: 0, clicked: 212, leads: 4 }, createdBy: owner(0), createdAt: new Date(now - 22 * DAY) },
      { id: t.id("campaign:market-letter"), tenantId: t.tenantId, name: "Quarterly market letter", channel: "email", status: "draft", segment: "all", subject: "The quarter in registered transactions", body: "", createdBy: owner(2), createdAt: new Date(now - 2 * DAY) },
    ])
    .onConflictDoNothing();

  /* team */
  const officesSeed = india
    ? [
        { key: "mumbai", name: "Mumbai head office", city: "Mumbai", address: "Level 9, One BKC, Bandra Kurla Complex, Mumbai 400051" },
        { key: "goa", name: "Goa office", city: "Goa", address: "Shop 4, Assagao Road, Bardez, Goa 403507" },
      ]
    : [
        { key: "abu-dhabi", name: "Abu Dhabi head office", city: "Abu Dhabi", address: "Floor 21, Al Maqam Tower, ADGM Square, Al Maryah Island" },
        { key: "dubai", name: "Dubai office", city: "Dubai", address: "Office 1404, Boulevard Plaza Tower 1, Downtown Dubai" },
      ];
  await db
    .insert(s.offices)
    .values(officesSeed.map((o, i) => ({ id: t.id(`office:${o.key}`), tenantId: t.tenantId, name: o.name, market: m.code, city: o.city, address: o.address, headUserId: owner(i === 0 ? 2 : 0) })))
    .onConflictDoNothing();
  const steps = ["Licence verified", "AML training", "CRM and listing standards", "First supervised viewing", "First listing taken"];
  if (staff.length)
    await db
      .insert(s.officeMembers)
      .values(
        staff.map((u, i) => ({
          id: t.id(`office-member:${i}`),
          tenantId: t.tenantId,
          officeId: t.id(`office:${officesSeed[i === 1 ? 1 : 0]!.key}`),
          userId: u,
          position: i === 2 ? "Managing partner" : i === 1 ? "Senior broker" : "Broker",
          licenceNumber: india ? `A5180000${3100 + i * 17}` : `BRN-${48210 + i * 113}`,
          licenceExpiry: new Date(now + (i === 1 ? 24 : 190 + i * 60) * DAY).toISOString().slice(0, 10),
          startedOn: new Date(now - (420 - i * 120) * DAY).toISOString().slice(0, 10),
          onboarding: steps.map((st, k) => ({ step: st, done: k < 5 - (i === 0 ? 0 : i === 1 ? 1 : 0) })),
        })),
      )
      .onConflictDoNothing();
  const q = new Date(now);
  const period = `${q.getUTCFullYear()}-Q${Math.floor(q.getUTCMonth() / 3) + 1}`;
  const gci = india ? 2_500_000 : 450_000;
  if (staff.length)
    await db
      .insert(s.teamTargets)
      .values(staff.flatMap((u, i) => [
        { id: t.id(`target:${i}:leads`), tenantId: t.tenantId, userId: u, period, metric: "leads_converted" as const, target: 4 },
        { id: t.id(`target:${i}:listings`), tenantId: t.tenantId, userId: u, period, metric: "listings_won" as const, target: 3 },
        { id: t.id(`target:${i}:deals`), tenantId: t.tenantId, userId: u, period, metric: "deals_closed" as const, target: 2 },
        { id: t.id(`target:${i}:gci`), tenantId: t.tenantId, userId: u, period, metric: "gci" as const, target: gci },
      ]))
      .onConflictDoNothing();
  await db
    .insert(s.recruits)
    .values([
      { id: t.id("recruit:1"), tenantId: t.tenantId, name: india ? "Nikhil Sawant" : "Reem Al Hashemi", email: null, role: "Broker", officeId: t.id(`office:${officesSeed[1]!.key}`), stage: "interview", source: "Referral from a current broker", experienceYears: 4, notes: "Strong secondary-market record; references requested." },
      { id: t.id("recruit:2"), tenantId: t.tenantId, name: india ? "Aparna Iyer" : "Daniel Mensah", email: null, role: "Leasing consultant", officeId: t.id(`office:${officesSeed[0]!.key}`), stage: "offer", source: "LinkedIn", experienceYears: 2, notes: "Offer sent; start date to agree." },
      { id: t.id("recruit:3"), tenantId: t.tenantId, name: india ? "Varun Kamat" : "Lina Chaudhry", email: null, role: "Broker", officeId: t.id(`office:${officesSeed[0]!.key}`), stage: "screening", source: "Careers page", experienceYears: 6, notes: null },
      { id: t.id("recruit:4"), tenantId: t.tenantId, name: india ? "Sana Merchant" : "Tom Gallagher", email: null, role: "Marketing executive", officeId: null, stage: "sourced", source: "Agency", experienceYears: 3, notes: null },
      { id: t.id("recruit:5"), tenantId: t.tenantId, name: india ? "Harsh Vora" : "Maya Kassem", email: null, role: "Broker", officeId: t.id(`office:${officesSeed[1]!.key}`), stage: "hired", source: "Referral from a current broker", experienceYears: 5, notes: "Licence transfer in progress." },
    ])
    .onConflictDoNothing();

  /* rentals */
  const rentals = india
    ? [
        { key: "powai", unit: "Hiranandani Gardens, Tower B, 1203", landlord: "rajesh", occupant: "Sneha Patil", rent: 95_000, frequency: "monthly" as const, instalments: 12, deposit: 570_000, reg: "LL-MH-2026-118734", startDays: -210 },
        { key: "bandra", unit: "Pali Hill, Flat 6A", landlord: "priya", occupant: "Arvind Nair", rent: 210_000, frequency: "monthly" as const, instalments: 12, deposit: 1_260_000, reg: "LL-MH-2025-093122", startDays: -330 },
      ]
    : [
        { key: "jvc", unit: "Binghatti Gems, Studio 614", landlord: "ahmed", occupant: "Priyanka Das", rent: 58_000, frequency: "annual" as const, instalments: 4, deposit: 2_900, reg: "EJ-0122-2026-55831", startDays: -95 },
        { key: "marina", unit: "Marina Gate 1, 2207", landlord: "khalid", occupant: "Martin Kowalski", rent: 165_000, frequency: "annual" as const, instalments: 2, deposit: 8_250, reg: "EJ-0122-2025-41209", startDays: -340 },
        { key: "yas", unit: "Yas Acres, Townhouse 88", landlord: "fatima", occupant: "Hamad Al Romaithi", rent: 190_000, frequency: "annual" as const, instalments: 4, deposit: 9_500, reg: "TW-2026-0098812", startDays: -40 },
      ];
  for (const [i, r] of rentals.entries()) {
    const start = new Date(now + r.startDays * DAY);
    const startDate = start.toISOString().slice(0, 10);
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    end.setUTCDate(end.getUTCDate() - 1);
    const tid = t.id(`tenancy:${r.key}`);
    await db
      .insert(s.tenancies)
      .values({ id: tid, tenantId: t.tenantId, reference: `TN-${String(i + 1).padStart(4, "0")}`, listingId: r.key === "jvc" ? t.id("listing:jvc-studio") : null, unit: r.unit, market: m.code, landlordClientId: client(r.landlord), landlordName: "", occupantName: r.occupant, occupantEmail: null, startDate, endDate: end.toISOString().slice(0, 10), rent: r.rent, currency: m.currency, frequency: r.frequency, instalments: r.instalments, deposit: r.deposit, registrationNumber: r.reg, managementFeePct: india ? 8 : 5 })
      .onConflictDoNothing();
    const today = new Date(now).toISOString().slice(0, 10);
    const schedule = rentSchedule({ startDate, rent: r.rent, frequency: r.frequency, instalments: r.instalments });
    await db
      .insert(s.rentPayments)
      .values(
        schedule.map((p, k) => {
          const past = p.dueDate < today;
          const late = past && i === rentals.length - 1 && k === schedule.filter((x) => x.dueDate < today).length - 1;
          return { id: t.id(`rent:${r.key}:${k}`), tenantId: t.tenantId, tenancyId: tid, dueDate: p.dueDate, amount: p.amount, currency: m.currency, status: past ? (late ? ("late" as const) : ("paid" as const)) : ("scheduled" as const), paidOn: past && !late ? p.dueDate : null, method: past && !late ? (india ? "NEFT" : "Cheque") : null };
        }),
      )
      .onConflictDoNothing();
    if (i < 2)
      await db
        .insert(s.maintenanceRequests)
        .values({ id: t.id(`maint:${r.key}`), tenantId: t.tenantId, tenancyId: tid, title: i === 0 ? "Air-conditioning not cooling in the bedroom" : "Leak under the kitchen sink", category: i === 0 ? "HVAC" : "Plumbing", priority: i === 0 ? "high" : "normal", status: i === 0 ? "scheduled" : "resolved", vendor: i === 0 ? (india ? "CoolAir Services" : "Emirates Cooling Services") : "In-house handyman", cost: i === 0 ? null : india ? 3_500 : 450, reportedAt: new Date(now - (i === 0 ? 2 : 18) * DAY), resolvedAt: i === 0 ? null : new Date(now - 16 * DAY) })
        .onConflictDoNothing();
  }
  // Landlord names follow the client record.
  await db.execute(sql`update tenancies set landlord_name = c.name from clients c where tenancies.landlord_client_id = c.id and tenancies.tenant_id = ${t.tenantId} and tenancies.landlord_name = ''`);

  /* referrals */
  await db
    .insert(s.referrals)
    .values([
      { id: t.id("referral:1"), tenantId: t.tenantId, referrerClientId: client("ahmed"), referrerName: "", referredName: names[2]!, referredEmail: null, leadId: t.id("lead:2"), status: "converted", rewardAmount: india ? 50_000 : 5_000, currency: m.currency, notes: "Colleague relocating; looking for a family home." },
      { id: t.id("referral:2"), tenantId: t.tenantId, referrerClientId: client("priya"), referrerName: "", referredName: names[9]!, referredEmail: null, leadId: t.id("lead:9"), status: "rewarded", rewardAmount: india ? 75_000 : 7_500, currency: m.currency, notes: null },
      { id: t.id("referral:3"), tenantId: t.tenantId, referrerClientId: client("khalid"), referrerName: "", referredName: india ? "Devika Rao" : "Tariq Mahmood", referredEmail: null, leadId: null, status: "received", rewardAmount: null, currency: m.currency, notes: "Owner considering a sale in the next quarter." },
    ])
    .onConflictDoNothing();
  await db.execute(sql`update referrals set referrer_name = c.name from clients c where referrals.referrer_client_id = c.id and referrals.tenant_id = ${t.tenantId} and referrals.referrer_name = ''`);

  return { leads: leadRows.length, listings: listingRows.length, tenancies: rentals.length };
}
