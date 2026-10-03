import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { AutomationAction, AutomationCondition, AutomationTrigger } from "@/db/schema";
import { notify, sendEmail } from "./notify";

/** OS events that fire automation triggers. */
export const EVENT_TRIGGER: Record<string, AutomationTrigger> = {
  "mandate.created": "mandate.created",
  "invoice.paid": "invoice.paid",
  "deal.closed": "deal.closed",
  "commission.computed": "commission.computed",
};

export interface AutomationFacts {
  jurisdiction?: string;
  deal_value_aed?: number;
  client_residency?: string;
  stage?: string;
  deal_type?: string;
  clientId?: string | null;
  dealId?: string | null;
  mandateId?: string | null;
  label: string;
  href?: string;
}

export function matches(conditions: AutomationCondition[], facts: AutomationFacts) {
  return conditions.every((c) => {
    const v = facts[c.field];
    if (v === undefined || v === null) return false;
    if (c.op === "eq") return String(v).toLowerCase() === String(c.value).toLowerCase();
    if (c.op === "contains") return String(v).toLowerCase().includes(String(c.value).toLowerCase());
    if (c.op === "gt") return Number(v) > Number(c.value);
    return Number(v) < Number(c.value);
  });
}

const AED_PER = { AED: 1, INR: 1 / 22.6, USD: 3.6725 } as Record<string, number>;

/** Facts an automation can test, derived from the deal (and client) behind an event. */
export async function factsFor(db: DB, tenantId: string, ref: { dealId?: string | null; clientId?: string | null; mandateId?: string | null; label: string; href?: string }): Promise<AutomationFacts> {
  const facts: AutomationFacts = { label: ref.label, href: ref.href, dealId: ref.dealId ?? null, clientId: ref.clientId ?? null, mandateId: ref.mandateId ?? null };
  if (ref.dealId) {
    const [d] = await db.select().from(s.deals).where(and(eq(s.deals.tenantId, tenantId), eq(s.deals.id, ref.dealId))).limit(1);
    if (d) Object.assign(facts, { jurisdiction: d.jurisdiction, deal_value_aed: Math.round(d.value * (AED_PER[d.currency] ?? 1)), stage: d.stage, deal_type: d.dealType, clientId: d.clientId });
  }
  if (facts.clientId) {
    const [c] = await db.select({ residency: s.clients.residency }).from(s.clients).where(and(eq(s.clients.tenantId, tenantId), eq(s.clients.id, facts.clientId))).limit(1);
    if (c) facts.client_residency = c.residency;
  }
  return facts;
}

async function perform(db: DB, tenantId: string, a: AutomationAction, facts: AutomationFacts, name: string): Promise<string> {
  const message = a.message ?? `${name}: ${facts.label}`;
  switch (a.type) {
    case "notify_team":
      return `notified ${await notify(db, { tenantId, category: "system", title: a.subject ?? name, body: message, href: facts.href, priority: "normal" })} team members`;
    case "send_email": {
      if (!a.to) return "skipped: no recipient";
      let to = a.to;
      if (a.to === "client" && facts.clientId) {
        const [u] = await db.select({ email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, tenantId), eq(s.users.clientId, facts.clientId), eq(s.users.role, "client"))).limit(1);
        if (!u) return "skipped: client has no portal login";
        to = u.email;
      }
      const sent = await sendEmail(db, { tenantId, to, subject: a.subject ?? name, text: message });
      return `email to ${to}: ${sent.status.replace("_", " ")}`;
    }
    case "create_task": {
      const due = new Date(Date.now() + (a.dueInDays ?? 3) * 86_400_000);
      await db
        .insert(s.insights)
        .values({ tenantId, clientId: facts.clientId ?? null, mandateId: facts.mandateId ?? null, kind: "follow_up", severity: "MEDIUM", audience: "analyst", title: a.subject ?? name, body: message, dedupeKey: `automation:${name}:${facts.dealId ?? facts.clientId ?? facts.mandateId ?? Date.now()}:${Date.now()}`, dueAt: due })
        .onConflictDoNothing();
      return `task due ${due.toISOString().slice(0, 10)}`;
    }
    case "generate_report": {
      if (!facts.clientId) return "skipped: no client";
      const { generateClientReport } = await import("@/lib/client/reports");
      const r = await generateClientReport(db, tenantId, facts.clientId, { type: "ad_hoc", actor: `Automation: ${name}` });
      return `report "${r.title}" generated`;
    }
    case "notify_slack": {
      if (!a.webhookUrl) return "skipped: no Slack webhook configured";
      const res = await fetch(a.webhookUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: message }) }).catch(() => null);
      return res?.ok ? "posted to Slack" : "Slack webhook failed";
    }
  }
}

/**
 * Runs every enabled automation for a trigger whose conditions match the
 * facts, performs its actions and records the run (matched or skipped).
 */
export async function runAutomations(db: DB, tenantId: string, trigger: AutomationTrigger, facts: AutomationFacts, eventId?: string) {
  const rules = await db.select().from(s.automations).where(and(eq(s.automations.tenantId, tenantId), eq(s.automations.trigger, trigger), eq(s.automations.enabled, true)));
  const results: { automation: string; status: "succeeded" | "skipped" | "failed" }[] = [];
  for (const r of rules) {
    if (!matches(r.conditions, facts)) {
      await db.insert(s.automationRuns).values({ tenantId, automationId: r.id, eventId: eventId ?? null, status: "skipped", detail: { matched: false, actions: [], reason: "Conditions not met" } });
      results.push({ automation: r.name, status: "skipped" });
      continue;
    }
    try {
      const done: { type: string; result: string }[] = [];
      for (const a of r.actions) done.push({ type: a.type, result: await perform(db, tenantId, a, facts, r.name) });
      await db.insert(s.automationRuns).values({ tenantId, automationId: r.id, eventId: eventId ?? null, status: "succeeded", detail: { matched: true, actions: done } });
      await db.update(s.automations).set({ lastRunAt: new Date(), runCount: sql`${s.automations.runCount} + 1` }).where(eq(s.automations.id, r.id));
      results.push({ automation: r.name, status: "succeeded" });
    } catch (e) {
      await db.insert(s.automationRuns).values({ tenantId, automationId: r.id, eventId: eventId ?? null, status: "failed", detail: { matched: true, actions: [], reason: (e as Error).message } });
      results.push({ automation: r.name, status: "failed" });
    }
  }
  return results;
}

export async function runAutomationsForEvent(db: DB, ev: typeof s.osEvents.$inferSelect) {
  const trigger = EVENT_TRIGGER[ev.type];
  if (!trigger) return [];
  const label = String(ev.payload.label ?? ev.type);
  const facts = await factsFor(db, ev.tenantId, { dealId: ev.dealId, clientId: ev.clientId, mandateId: ev.mandateId, label, href: typeof ev.payload.href === "string" ? ev.payload.href : undefined });
  return runAutomations(db, ev.tenantId, trigger, facts, ev.id);
}
