import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import * as s from "@/db/schema";
import { icsFeed, openSlots, slotLabel, zoned } from "@/lib/lead-response/calendar";
import { extract, parseBudget, parseSlotChoice } from "@/lib/lead-response/extract";
import { completeness, decide, type Known, merge, questionOrder } from "@/lib/lead-response/policy";
import { testDb } from "./helpers/pglite";

const AREAS = ["Dubai Marina", "Downtown Dubai", "Jumeirah Village Circle", "Palm Jumeirah", "Business Bay"];

describe("extraction", () => {
  it("reads budgets in every format buyers use", () => {
    expect(parseBudget("Budget is around AED 2.5m", "AED")).toMatchObject({ max: 2_500_000, currency: "AED" });
    expect(parseBudget("up to 3,200,000 dirhams", "AED")).toMatchObject({ max: 3_200_000, currency: "AED" });
    expect(parseBudget("Looking at 1.5 cr in Worli", "INR")).toMatchObject({ max: 15_000_000, currency: "INR" });
    expect(parseBudget("budget 85 lakhs", "INR")).toMatchObject({ max: 8_500_000 });
    expect(parseBudget("£950k maximum", "GBP")).toMatchObject({ max: 950_000, currency: "GBP" });
    expect(parseBudget("between 2 and 3 million", "AED")).toMatchObject({ min: 2_000_000, max: 3_000_000 });
    expect(parseBudget("2-3.5m please", "AED")).toMatchObject({ min: 2_000_000, max: 3_500_000 });
    expect(parseBudget("at least 4 million", "AED")).toMatchObject({ min: 4_000_000, max: null });
  });
  it("does not mistake bedrooms, months or areas for money", () => {
    expect(parseBudget("a 2 bedroom in 3 months", "AED")).toBeNull();
    expect(parseBudget("around 1,200 sq ft on floor 20", "AED")).toBeNull();
  });
  it("reads timeline, areas with aliases, bedrooms, motivation and financing with evidence", () => {
    const e = extract("We are relocating from London and want a 3 bed in JVC or the Marina, ideally within 2 months. Mortgage pre-approved.", { currency: "AED", areas: AREAS });
    expect(e.timeline?.value).toBe("3_months");
    expect(e.areas?.value).toEqual(["Jumeirah Village Circle", "Dubai Marina"]);
    expect(e.bedrooms?.value).toBe(3);
    expect(e.motivation?.value).toBe("relocation");
    expect(e.financing?.value).toBe("mortgage_approved");
    expect(e.financing?.evidence).toContain("Mortgage pre-approved");
  });
  it("classifies cash, investment, studios and exploring", () => {
    const e = extract("Just browsing for now, a studio as an investment for rental yield, cash buyer", { currency: "AED", areas: AREAS });
    expect(e.timeline?.value).toBe("exploring");
    expect(e.bedrooms?.value).toBe(0);
    expect(e.motivation?.value).toBe("investment");
    expect(e.financing?.value).toBe("cash");
  });
  it("detects the intents that change the conversation", () => {
    expect(extract("Can someone call me please", { currency: "AED", areas: [] }).intents.requestsAgent).toBe(true);
    expect(extract("This is unacceptable, I want a refund", { currency: "AED", areas: [] }).intents.complaint).toBe(true);
    expect(extract("What is the DLD fee and who pays the title deed registration?", { currency: "AED", areas: [] }).intents.complexQuestion).toBe("title and registration");
    expect(extract("Can I view it this weekend?", { currency: "AED", areas: [] }).intents.wantsViewing).toBe(true);
    expect(extract("Thanks but we already bought elsewhere", { currency: "AED", areas: [] }).intents.declines).toBe(true);
  });
  it("matches a slot by number, ordinal, weekday or time, and refuses ambiguity", () => {
    const slots = ["Thursday 8 October, 10:00", "Thursday 8 October, 14:00", "Friday 9 October, 10:00"];
    expect(parseSlotChoice("2", slots)).toBe(2);
    expect(parseSlotChoice("Option 3 please", slots)).toBe(3);
    expect(parseSlotChoice("the first one works", slots)).toBe(1);
    expect(parseSlotChoice("Friday is good", slots)).toBe(3);
    expect(parseSlotChoice("Thursday at 2pm", slots)).toBe(2);
    expect(parseSlotChoice("Thursday", slots)).toBeNull();
    expect(parseSlotChoice("4", slots)).toBeNull();
  });
});

describe("calendar", () => {
  const hours = { start: "09:00", end: "19:00", days: [1, 2, 3, 4, 5, 6], timezone: "Asia/Dubai" };
  it("converts wall-clock time in a time zone to an instant", () => {
    expect(zoned(2026, 10, 8, 10, 0, "Asia/Dubai").toISOString()).toBe("2026-10-08T06:00:00.000Z");
    expect(zoned(2026, 7, 1, 9, 0, "Europe/London").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(zoned(2026, 12, 1, 9, 0, "Europe/London").toISOString()).toBe("2026-12-01T09:00:00.000Z");
  });
  it("offers slots inside working hours, after the lead time, skipping Sundays and busy times", () => {
    const now = new Date("2026-10-03T14:00:00Z"); // Saturday 18:00 in Dubai
    const busy = [{ startsAt: new Date("2026-10-05T06:00:00Z"), endsAt: new Date("2026-10-05T06:45:00Z") }]; // Monday 10:00
    const slots = openSlots(hours, busy, { now, minutes: 45 });
    expect(slots).toHaveLength(3);
    for (const d of slots) {
      const label = slotLabel(d, "Asia/Dubai");
      expect(label).not.toMatch(/Sunday/);
      const h = Number(label.slice(-5, -3));
      expect(h).toBeGreaterThanOrEqual(9);
      expect(h).toBeLessThan(19);
    }
    expect(slots.some((d) => d.getTime() === busy[0]!.startsAt.getTime())).toBe(false);
    expect(slotLabel(slots[0]!, "Asia/Dubai")).toMatch(/^Monday 5 October/);
  });
  it("produces an iCalendar feed calendar clients accept", () => {
    const ics = icsFeed("Viewings", [{ id: "b1", startsAt: new Date("2026-10-08T06:00:00Z"), endsAt: new Date("2026-10-08T06:45:00Z"), summary: "Viewing, Marina Gate", description: "Lead LD-0001", location: "Marina Gate, Dubai Marina", status: "confirmed", updatedAt: new Date("2026-10-04T00:00:00Z") }]);
    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("DTSTART:20261008T060000Z");
    expect(ics).toContain("LOCATION:Marina Gate\\, Dubai Marina");
  });
});

describe("policy", () => {
  const base: Known = { budgetMin: null, budgetMax: null, currency: "AED", timeline: null, areas: [], bedrooms: null, motivation: null, financing: null };
  const ex = (t: string, slots: string[] = []) => extract(t, { currency: "AED", areas: AREAS, slots });
  const input = (known: Known, text: string, extra: Partial<Parameters<typeof decide>[0]> = {}) => ({ known, intent: "buy", extraction: ex(text), learning: null, pendingSlots: [], askedCount: {}, budgetAed: known.budgetMax, highValueAed: 10_000_000, hasListing: false, firstTurn: false, ...extra });
  it("learns the question order from answer rates", () => {
    const learning = { answers: { area: { asked: 10, answered: 2 }, budget: { asked: 10, answered: 9 } }, examples: [], conversions: { qualified: 0, booked: 0, handedOff: 0, total: 0 } };
    expect(questionOrder(learning, "buy")[0]).toBe("budget");
    expect(questionOrder(null, "buy")[0]).toBe("area");
    expect(questionOrder(null, "rent")).not.toContain("financing");
  });
  it("asks for the first missing field, then offers viewings once the core is known", () => {
    expect(decide(input(base, "Is it available?"))).toEqual({ kind: "ask", field: "area" });
    const { known } = merge(base, ex("Dubai Marina, up to 2.5m, within 3 months"));
    expect(completeness(known, "buy")).toBe(60);
    expect(decide(input(known, "Dubai Marina, up to 2.5m, within 3 months"))).toEqual({ kind: "offer_viewing" });
  });
  it("hands over complaints, agent requests, complex questions and high-value buyers before anything else", () => {
    expect(decide(input(base, "Terrible service, I want to complain"))).toMatchObject({ kind: "handoff", reason: "complaint" });
    expect(decide(input(base, "Please call me"))).toMatchObject({ kind: "handoff", reason: "requested_agent" });
    expect(decide(input(base, "How does stamp duty work for me?"))).toMatchObject({ kind: "handoff", reason: "complex_question" });
    expect(decide(input({ ...base, budgetMax: 25_000_000 }, "Palm Jumeirah villa"))).toMatchObject({ kind: "handoff", reason: "high_value" });
  });
  it("books a chosen slot and does not press a question asked twice", () => {
    const slots = ["Monday 5 October, 10:00", "Monday 5 October, 14:00", "Tuesday 6 October, 10:00"];
    expect(decide(input(base, "2", { extraction: ex("2", slots), pendingSlots: ["a", "b", "c"] }))).toEqual({ kind: "book", slot: 2 });
    expect(decide(input(base, "ok", { askedCount: { area: 2 } }))).toEqual({ kind: "ask", field: "budget" });
    expect(decide(input(base, "ok", { askedCount: { area: 2, budget: 2, timeline: 2, financing: 2, motivation: 2 } }))).toMatchObject({ kind: "handoff", reason: "unresponsive" });
  });
});

describe("conversations end to end", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let wa: typeof import("@/lib/whatsapp/service");
  let lr: typeof import("@/lib/lead-response/service");
  let account: typeof s.whatsappAccounts.$inferSelect;
  let listingId: string;
  beforeAll(async () => {
    env = await testDb();
    wa = await import("@/lib/whatsapp/service");
    lr = await import("@/lib/lead-response/service");
    await import("@/lib/lead-response/install");
    account = await wa.connectWhatsapp(env.db, env.a.id, { provider: "sandbox", phoneNumber: "+971 4 555 0000", creds: {}, origin: "https://app.example.com" });
    const [l] = await env.db.insert(s.listings).values({ tenantId: env.a.id, reference: "NK-1001", title: "Two-bedroom apartment, Marina Gate", market: "AE", city: "Dubai", community: "Dubai Marina", propertyType: "Apartment", purpose: "sale", status: "active", price: 2_400_000, currency: "AED", area: 1_250, areaUnit: "sqft", bedrooms: 2, bathrooms: 2 } as typeof s.listings.$inferInsert).returning();
    listingId = l!.id;
  });

  const outbound = async (conversationId: string) => (await env.db.select().from(s.whatsappMessages).where(and(eq(s.whatsappMessages.conversationId, conversationId), eq(s.whatsappMessages.direction, "outbound")))).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  it("replies on WhatsApp in place of the generic welcome, in under ten seconds, and qualifies over turns", async () => {
    const r = await wa.receiveInbound(env.db, account, { from: "+971501230001", name: "Rania Haddad", type: "text", text: "Hello, is there anything available in Dubai Marina?", providerMessageId: "lr-1" });
    const out = await outbound(r.conversationId!);
    expect(out).toHaveLength(1);
    expect(out[0]!.sentBy).toBe("Assistant");
    expect(out[0]!.content.text).toContain("Good day Rania");
    expect(out[0]!.content.text).toContain("What budget range");
    const [conv] = await env.db.select().from(s.leadConversations).where(eq(s.leadConversations.externalRef, r.conversationId!));
    expect(conv!.firstResponseMs).toBeLessThan(10_000);
    await wa.receiveInbound(env.db, account, { from: "+971501230001", type: "text", text: "Up to AED 2.5m, cash", providerMessageId: "lr-2" });
    const out2 = await outbound(r.conversationId!);
    expect(out2.at(-1)!.content.text).toContain("Noted: a budget of up to AED 2,500,000 and a cash purchase.");
    expect(out2.at(-1)!.content.text).toContain("When are you hoping");
    const [q] = await env.db.select().from(s.leadQualifications).where(eq(s.leadQualifications.leadId, conv!.leadId));
    expect(q).toMatchObject({ budgetMax: 2_500_000, financing: "cash", areas: ["Dubai Marina"] });
    expect(q!.evidence.budget).toBe("Up to AED 2.5m, cash");
    const [cfg] = await env.db.select().from(s.leadResponseSettings).where(eq(s.leadResponseSettings.tenantId, env.a.id));
    expect(cfg!.learning.answers.budget).toEqual({ asked: 1, answered: 1 });
  });

  it("offers slots, books the chosen one against the calendar and hands the lead to its agent", async () => {
    const r = await wa.receiveInbound(env.db, account, { from: "+971501230001", type: "text", text: "Within the next 3 months", providerMessageId: "lr-3" });
    const offer = (await outbound(r.conversationId!)).at(-1)!.content.text!;
    expect(offer).toMatch(/1\. .+\n2\. .+\n3\. /);
    await wa.receiveInbound(env.db, account, { from: "+971501230001", type: "text", text: "2", providerMessageId: "lr-4" });
    const confirm = (await outbound(r.conversationId!)).at(-1)!.content.text!;
    expect(confirm).toContain("Your viewing is confirmed for");
    const [conv] = await env.db.select().from(s.leadConversations).where(eq(s.leadConversations.externalRef, r.conversationId!));
    expect(conv!.status).toBe("booked");
    const [b] = await env.db.select().from(s.viewingBookings).where(eq(s.viewingBookings.leadId, conv!.leadId));
    expect(b!.bookedBy).toBe("Assistant");
    expect(confirm).toContain(slotLabel(b!.startsAt, "Asia/Dubai"));
    const [lead] = await env.db.select().from(s.leads).where(eq(s.leads.id, conv!.leadId));
    expect(lead!.stage).toBe("viewing");
    const handoffs = await env.db.select().from(s.leadHandoffs).where(eq(s.leadHandoffs.leadId, lead!.id));
    expect(handoffs.map((h) => h.reason)).toEqual(["viewing_booked"]);
    // Once booked the agent owns the thread: further messages are recorded, not answered.
    const before = (await outbound(r.conversationId!)).length;
    await wa.receiveInbound(env.db, account, { from: "+971501230001", type: "text", text: "Is parking included?", providerMessageId: "lr-5" });
    expect((await outbound(r.conversationId!)).length).toBe(before);
  });

  it("hands complaints to an agent, switches WhatsApp to the agent and sets an SLA", async () => {
    const r = await wa.receiveInbound(env.db, account, { from: "+971501230002", name: "Omar Saleh", type: "text", text: "Your agent never turned up, this is unacceptable", providerMessageId: "lr-6" });
    expect((await outbound(r.conversationId!)).at(-1)!.content.text).toContain("I am sorry to hear this.");
    const [c] = await env.db.select().from(s.whatsappConversations).where(eq(s.whatsappConversations.id, r.conversationId!));
    expect(c!.mode).toBe("human");
    const [h] = await env.db.select().from(s.leadHandoffs).where(eq(s.leadHandoffs.reason, "complaint"));
    expect(h!.slaDueAt.getTime() - h!.createdAt.getTime()).toBeGreaterThan(29 * 60_000);
  });

  it("closes the lead as lost when the contact withdraws", async () => {
    const r = await wa.receiveInbound(env.db, account, { from: "+971501230003", name: "Lena Brandt", type: "text", text: "Sorry, not interested any more, we already bought", providerMessageId: "lr-7" });
    const [c] = await env.db.select().from(s.whatsappConversations).where(eq(s.whatsappConversations.id, r.conversationId!));
    const [lead] = await env.db.select().from(s.leads).where(eq(s.leads.id, c!.leadId!));
    expect(lead!.stage).toBe("lost");
    expect(lead!.lostReason).toContain("Withdrew during first response");
  });

  it("answers website and portal leads by email, and threads emailed replies to the same lead", async () => {
    const { createLead } = await import("@/lib/brokerage/leads");
    const lead = await createLead(env.db, env.a.id, { name: "James Carter", email: "james.carter@example.com", source: "website", market: "AE", intent: "buy", listingId, message: "Interested in this apartment. Budget up to 2.6 million." }, { name: "Website" });
    const r = await lr.greetNewLead(env.db, env.a.id, lead.id, "website");
    expect(r.skipped).toBeNull();
    const mails = await env.db.select().from(s.emailOutbox).where(eq(s.emailOutbox.toEmail, "james.carter@example.com"));
    expect(mails).toHaveLength(1);
    expect(mails[0]!.bodyText).toContain("about Two-bedroom apartment, Marina Gate");
    expect(mails[0]!.bodyText).not.toContain("Which areas");
    const r2 = await lr.inboundEmail(env.db, env.a.id, { from: "James Carter <James.Carter@example.com>", text: "We would like to buy in the next 2 months.\n\nOn Mon, 5 Oct 2026, Nakhla wrote:\n> What budget range", subject: "Re: Your enquiry" });
    expect(r2.skipped).toBeNull();
    const convs = await env.db.select().from(s.leadConversations).where(eq(s.leadConversations.leadId, lead.id));
    expect(convs).toHaveLength(1);
    expect(convs[0]!.turns.filter((t) => t.role === "lead").at(-1)!.text).toBe("We would like to buy in the next 2 months.");
  });

  it("uses the model's wording when it answers in time and the policy's reply when it does not", async () => {
    const { withAgentRuntime } = await import("@/lib/ai/runtime");
    const { MockLLMClient } = await import("@/lib/ai/testing/mock-llm");
    const { InMemoryMemoryStore } = await import("@/lib/ai/memory/store");
    const { createLead } = await import("@/lib/brokerage/leads");
    const rt = { memory: new InMemoryMemoryStore(), recorder: async () => {}, skipControl: true };
    const llm = new MockLLMClient({ "lead-responder": { headline: "Asks which communities the lead is considering.", points: [{ label: "Decision", detail: "ask" }], confidence: 0.8, reply: "Thank you for your enquiry. Which communities are you considering?" } });
    const l1 = await createLead(env.db, env.a.id, { name: "Mei Tan", email: "mei.tan@example.com", source: "website", market: "AE", intent: "buy", message: "Looking for a family home" }, { name: "Website" });
    const r1 = await withAgentRuntime({ ...rt, llm }, () => lr.greetNewLead(env.db, env.a.id, l1.id, "website"));
    expect(r1).toMatchObject({ reply: "Thank you for your enquiry. Which communities are you considering?", model: expect.stringContaining("claude") });
    expect(llm.calls[0]!.user).toMatch(/"decision": "ask:[a-z]+"/);
    const slow = { name: "mock" as const, recordsOwnRuns: false, structured: () => new Promise<never>(() => {}) };
    process.env.LEAD_RESPONSE_MODEL_BUDGET_MS = "200";
    const l2 = await createLead(env.db, env.a.id, { name: "Ahmed Rashid", email: "ahmed.rashid@example.com", source: "website", market: "AE", intent: "buy", message: "Do you have villas?" }, { name: "Website" });
    const r2 = await withAgentRuntime({ ...rt, llm: slow as never }, () => lr.greetNewLead(env.db, env.a.id, l2.id, "website"));
    delete process.env.LEAD_RESPONSE_MODEL_BUDGET_MS;
    expect(r2).toMatchObject({ model: "policy" });
    expect((r2 as { latencyMs: number }).latencyMs).toBeLessThan(10_000);
  });

  it("creates a lead from a new email with the sender's name and the right intent", async () => {
    const r = await lr.inboundEmail(env.db, env.a.id, { from: "Sofia Laurent <sofia.laurent@example.com>", text: "We are looking for a 2 bedroom in Downtown Dubai to rent, moving in next month." });
    expect(r.skipped).toBeNull();
    const [lead] = await env.db.select().from(s.leads).where(eq(s.leads.email, "sofia.laurent@example.com"));
    expect(lead).toMatchObject({ name: "Sofia Laurent", intent: "rent", source: "email" });
    expect((r as { reply: string }).reply).toContain("Good day Sofia");
  });

  it("keeps each firm's conversations and settings separate", async () => {
    const [leadA] = await env.db.select().from(s.leads).where(eq(s.leads.tenantId, env.a.id)).limit(1);
    await expect(lr.respond(env.db, { tenantId: env.b.id, leadId: leadA!.id, channel: "email", text: "Hello" })).rejects.toThrow(/not found/i);
    await lr.saveLrSettings(env.db, env.b.id, { enabled: false });
    expect((await lr.lrConfig(env.db, env.a.id)).settings.enabled).toBe(true);
  });

  it("reports response time, qualification, hand-offs and bookings", async () => {
    const m = await lr.lrMetrics(env.db, env.a.id);
    expect(m.conversations).toBeGreaterThanOrEqual(4);
    expect(m.underTenSeconds).toBe(1);
    expect(m.bookings).toBe(1);
    expect(m.byReason.complaint).toBe(1);
  });
});
