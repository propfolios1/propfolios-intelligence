import { and, eq } from "drizzle-orm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import * as s from "@/db/schema";
import { parseCloud, parseTwilio } from "@/lib/whatsapp/inbound";
import { renderTemplate, sendMedia, sendTemplate, templateVariables, twilioSignature, verifyTwilio } from "@/lib/whatsapp/providers";
import { testDb } from "./helpers/pglite";

afterEach(() => vi.unstubAllGlobals());

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

describe("providers", () => {
  it("sends a template through Twilio with the Content SID and numbered variables", async () => {
    let call: { url: string; body: URLSearchParams; auth: string | null } | null = null;
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      call = { url, body: new URLSearchParams(String(init.body)), auth: new Headers(init.headers).get("authorization") };
      return json({ sid: "SM123", status: "queued" }, 201);
    });
    const r = await sendTemplate({ provider: "twilio", phoneNumber: "+97145550000", accountRef: "AC1", creds: { authToken: "tok" } }, "+971501234567", { name: "viewing_reminder", language: "en", providerRef: "HX99" }, ["Sarah", "Saturday 11:00"]);
    expect(r).toEqual({ providerMessageId: "SM123", status: "queued" });
    expect(call!.url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect(call!.body.get("To")).toBe("whatsapp:+971501234567");
    expect(call!.body.get("ContentSid")).toBe("HX99");
    expect(JSON.parse(call!.body.get("ContentVariables")!)).toEqual({ "1": "Sarah", "2": "Saturday 11:00" });
    expect(call!.auth).toBe(`Basic ${Buffer.from("AC1:tok").toString("base64")}`);
  });
  it("sends templates and media through 360dialog in the Cloud API format", async () => {
    const bodies: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      expect(new Headers(init.headers).get("d360-api-key")).toBe("key360");
      return json({ messages: [{ id: `wamid.${bodies.length}` }] });
    });
    const acc = { provider: "360dialog" as const, phoneNumber: "+97145550000", accountRef: null, creds: { apiKey: "key360" } };
    await sendTemplate(acc, "+971 50 123 4567", { name: "new_listing", language: "en", providerRef: null }, ["Marina Gate 2"]);
    await sendMedia(acc, "+971501234567", { type: "document", url: "https://cdn.example.com/brochure.pdf", filename: "Brochure.pdf", caption: "Floor plans" });
    expect(bodies[0]).toMatchObject({ messaging_product: "whatsapp", to: "971501234567", type: "template", template: { name: "new_listing", language: { code: "en" }, components: [{ type: "body", parameters: [{ type: "text", text: "Marina Gate 2" }] }] } });
    expect(bodies[1]).toMatchObject({ type: "document", document: { link: "https://cdn.example.com/brochure.pdf", filename: "Brochure.pdf", caption: "Floor plans" } });
  });
  it("verifies Twilio signatures and rejects tampered requests", () => {
    const params = { From: "whatsapp:+971501234567", Body: "Hello", MessageSid: "SM1" };
    const sig = twilioSignature("secret", "https://app.example.com/api/webhooks/whatsapp/twilio/t", params);
    expect(verifyTwilio("secret", "https://app.example.com/api/webhooks/whatsapp/twilio/t", params, sig)).toBe(true);
    expect(verifyTwilio("secret", "https://app.example.com/api/webhooks/whatsapp/twilio/t", { ...params, Body: "Changed" }, sig)).toBe(false);
    expect(verifyTwilio("secret", "https://app.example.com/x", params, null)).toBe(false);
  });
  it("checks template placeholders and renders them", () => {
    expect(templateVariables("Hello {{1}}, your viewing is on {{2}}.")).toEqual({ count: 2, consecutive: true });
    expect(templateVariables("Hello {{1}} and {{3}}").consecutive).toBe(false);
    expect(renderTemplate("Hello {{1}}", ["Omar"])).toBe("Hello Omar");
  });
  it("parses Twilio and Cloud API webhooks, including media and statuses", () => {
    const t = parseTwilio({ From: "whatsapp:+971501234567", ProfileName: "Omar", Body: "Floor plan?", NumMedia: "1", MediaUrl0: "https://api.twilio.com/media/ME1", MediaContentType0: "image/jpeg", MessageSid: "SM9" });
    expect(t.inbound).toMatchObject({ from: "+971501234567", type: "image", mediaRef: "https://api.twilio.com/media/ME1", caption: "Floor plan?" });
    expect(parseTwilio({ MessageSid: "SM9", MessageStatus: "undelivered", ErrorCode: "63016" }).status).toEqual({ id: "SM9", status: "failed", error: "Twilio error 63016" });
    const c = parseCloud({ entry: [{ changes: [{ value: { contacts: [{ wa_id: "971501234567", profile: { name: "Omar" } }], messages: [{ from: "971501234567", id: "wamid.A", timestamp: "1767225600", type: "audio", audio: { id: "MEDIA1", mime_type: "audio/ogg" } }], statuses: [{ id: "wamid.B", status: "read", timestamp: "1767225700" }] } }] }] });
    expect(c.inbound[0]).toMatchObject({ name: "Omar", type: "audio", mediaRef: "MEDIA1", mime: "audio/ogg" });
    expect(c.statuses[0]).toMatchObject({ id: "wamid.B", status: "read" });
  });
});

describe("conversations", () => {
  let env: Awaited<ReturnType<typeof testDb>>;
  let wa: typeof import("@/lib/whatsapp/service");
  let account: typeof s.whatsappAccounts.$inferSelect;
  const actor = { id: null, name: "Agent" };
  beforeAll(async () => {
    env = await testDb();
    wa = await import("@/lib/whatsapp/service");
    account = await wa.connectWhatsapp(env.db, env.a.id, { provider: "sandbox", phoneNumber: "+971 4 555 0000", creds: {}, origin: "https://app.example.com" });
    await wa.saveSettings(env.db, env.a.id, { ...wa.DEFAULT_SETTINGS, hours: null, throttlePerMinute: 3 });
    account = (await env.db.select().from(s.whatsappAccounts).where(eq(s.whatsappAccounts.id, account.id)))[0]!;
  }, 120_000);

  it("routes a first message to a new lead and conversation, sends the welcome once, and ignores duplicates", async () => {
    const r = await wa.receiveInbound(env.db, account, { from: "+971501111111", name: "Sarah Whitfield", type: "text", text: "Is the Marina flat available?", providerMessageId: "in-1" });
    expect(r).toMatchObject({ duplicate: false, isNewLead: true });
    const [lead] = await env.db.select().from(s.leads).where(eq(s.leads.phone, "+971501111111"));
    expect(lead).toMatchObject({ name: "Sarah Whitfield", source: "whatsapp", tenantId: env.a.id });
    const [conv] = await env.db.select().from(s.whatsappConversations).where(eq(s.whatsappConversations.contactPhone, "+971501111111"));
    expect(conv!.leadId).toBe(lead!.id);
    expect((await wa.receiveInbound(env.db, account, { from: "+971501111111", type: "text", text: "Again", providerMessageId: "in-1" })).duplicate).toBe(true);
    await wa.receiveInbound(env.db, account, { from: "+971501111111", type: "text", text: "Second message", providerMessageId: "in-2" });
    const msgs = await wa.thread(env.db, env.a.id, conv!.id);
    expect(msgs.filter((m) => m.direction === "outbound" && m.sentBy === "Automation")).toHaveLength(1);
    expect(msgs.filter((m) => m.direction === "inbound")).toHaveLength(2);
  });

  it("links an inbound message to an existing lead by phone, and stores media", async () => {
    await env.db.insert(s.leads).values({ tenantId: env.a.id, reference: "LD-0900", name: "Rahul Khanna", phone: "+971 50 222 2222", source: "bayut", market: "AE", intent: "buy", currency: "AED" });
    const r = await wa.receiveInbound(env.db, account, { from: "971502222222", type: "image", caption: "This one", mediaRef: "MEDIA9", mime: "image/jpeg", providerMessageId: "in-3" });
    expect(r).toMatchObject({ isNewLead: false });
    const [m] = await env.db.select().from(s.whatsappMessages).where(eq(s.whatsappMessages.providerMessageId, "in-3"));
    expect(m).toMatchObject({ type: "image", mediaUrl: "MEDIA9", content: { caption: "This one", mime: "image/jpeg" } });
  });

  it("enforces the 24-hour window for free-form messages but allows approved templates", async () => {
    const c = await wa.conversationFor(env.db, env.a.id, "+971503333333", "Cold contact");
    await expect(wa.sendMessage(env.db, env.a.id, c.id, { kind: "text", text: "Hello" }, actor)).rejects.toThrow(/24 hours/);
    const tpl = await wa.createTemplate(env.db, env.a.id, { name: "Viewing reminder", category: "UTILITY", language: "en", body: "Hello {{1}}, your viewing is confirmed for {{2}}.", variables: ["Sarah", "Saturday 11:00"] });
    expect(tpl.name).toBe("viewing_reminder");
    await expect(wa.sendMessage(env.db, env.a.id, c.id, { kind: "template", templateId: tpl.id, variables: ["Sam", "Monday"] }, actor)).rejects.toThrow(/draft/);
    await wa.submitForApproval(env.db, env.a.id, tpl.id);
    const sent = await wa.sendMessage(env.db, env.a.id, c.id, { kind: "template", templateId: tpl.id, variables: ["Sam", "Monday 10:00"] }, actor);
    expect(sent).toMatchObject({ status: "sent", type: "template", content: { text: "Hello Sam, your viewing is confirmed for Monday 10:00." } });
    await expect(wa.createTemplate(env.db, env.a.id, { name: "Bad", category: "UTILITY", language: "en", body: "Hi {{1}} {{3}}", variables: ["a", "b"] })).rejects.toThrow(/without gaps/);
  });

  it("applies delivery receipts in order only", async () => {
    const [m] = await env.db.select().from(s.whatsappMessages).where(and(eq(s.whatsappMessages.direction, "outbound"), eq(s.whatsappMessages.type, "template")));
    expect(await wa.applyStatus(env.db, m!.providerMessageId!, "read")).toBe(true);
    expect(await wa.applyStatus(env.db, m!.providerMessageId!, "delivered")).toBe(false);
    const [after] = await env.db.select().from(s.whatsappMessages).where(eq(s.whatsappMessages.id, m!.id));
    expect(after!.status).toBe("read");
  });

  it("honours STOP and START, and broadcasts only to consented contacts within the throttle", async () => {
    const tpl = await wa.createTemplate(env.db, env.a.id, { name: "new listing", category: "MARKETING", language: "en", body: "Hello {{1}}, a new home in {{2}} has just been listed.", variables: ["Sarah", "Dubai Marina"] });
    await wa.submitForApproval(env.db, env.a.id, tpl.id);
    await env.db.insert(s.leads).values(Array.from({ length: 6 }, (_, i) => ({ tenantId: env.a.id, reference: `LD-08${i}0`, name: `Buyer ${i} Test`, phone: `+97150444000${i}`, source: "website", market: "AE", intent: "buy" as const, currency: "AED", consentMarketing: i !== 5 })));
    await wa.receiveInbound(env.db, account, { from: "+971504440004", type: "text", text: "STOP", providerMessageId: "in-stop" });
    const [stopped] = await env.db.select().from(s.leads).where(eq(s.leads.phone, "+971504440004"));
    expect(stopped!.consentMarketing).toBe(false);
    const bc = await wa.createBroadcast(env.db, env.a.id, { name: "Marina launch", templateId: tpl.id, variables: ["{first_name}", "Dubai Marina"], segment: "buyers" }, actor);
    expect(bc.totals.queued).toBe(4);
    // A minute after the earlier replies, so the throttle window holds only this broadcast.
    const first = await wa.dispatchQueued(env.db, { tenantId: env.a.id, now: Date.now() + 61_000 });
    expect(first.sent).toBe(3);
    const later = await wa.dispatchQueued(env.db, { tenantId: env.a.id, now: Date.now() + 122_000 });
    expect(later.sent).toBe(1);
    const [done] = await env.db.select().from(s.whatsappBroadcasts).where(eq(s.whatsappBroadcasts.id, bc.id));
    expect(done!.status).toBe("completed");
    const msgs = await env.db.select().from(s.whatsappMessages).where(eq(s.whatsappMessages.broadcastId, bc.id));
    expect(msgs.map((m) => m.content.text)).toContain("Hello Buyer, a new home in Dubai Marina has just been listed.");
    await wa.receiveInbound(env.db, account, { from: "+971504440004", type: "text", text: "start", providerMessageId: "in-start" });
    expect((await env.db.select().from(s.leads).where(eq(s.leads.phone, "+971504440004")))[0]!.consentMarketing).toBe(true);
  });

  it("hands a conversation to an agent and keeps firms apart", async () => {
    const [c] = await env.db.select().from(s.whatsappConversations).where(eq(s.whatsappConversations.contactPhone, "+971501111111"));
    const taken = await wa.setMode(env.db, env.a.id, c!.id, "human", { id: env.ua.id, name: "Admin A" });
    expect(taken).toMatchObject({ mode: "human", assignedTo: env.ua.id });
    await wa.receiveInbound(env.db, account, { from: "+971501111111", type: "text", text: "Third", providerMessageId: "in-4" });
    expect((await wa.thread(env.db, env.a.id, c!.id)).filter((m) => m.sentBy === "Automation")).toHaveLength(1);
    await expect(wa.setMode(env.db, env.b.id, c!.id, "assistant", { id: null, name: "B" })).rejects.toThrow(/not found/);
    expect(await wa.thread(env.db, env.b.id, c!.id)).toHaveLength(0);
  });
});
