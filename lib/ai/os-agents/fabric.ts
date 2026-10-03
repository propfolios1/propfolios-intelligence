import "server-only";
import { z } from "zod";
import { agentCore, defineAgent } from "../agents/define";
import { tally } from "../memory/updater";
import { AUDIT_NARRATOR_SYSTEM, AUDIT_NARRATOR_VERSION } from "../prompts/audit-narrator_v1";
import { AUTOMATION_BUILDER_SYSTEM, AUTOMATION_BUILDER_VERSION } from "../prompts/automation-builder_v1";
import { DATA_QUALITY_SYSTEM, DATA_QUALITY_VERSION } from "../prompts/data-quality-agent_v1";
import { NOTIFICATION_ROUTER_SYSTEM, NOTIFICATION_ROUTER_VERSION } from "../prompts/notification-router_v1";
import { PERMISSION_SUGGESTER_SYSTEM, PERMISSION_SUGGESTER_VERSION } from "../prompts/permission-suggester_v1";

const TRIGGERS = ["deal.stage_changed", "mandate.created", "invoice.paid", "kyc.expired", "deal.closed", "commission.computed"] as const;
const FIELDS = ["jurisdiction", "deal_value_aed", "client_residency", "stage", "deal_type"] as const;
const ACTIONS = ["send_email", "create_task", "generate_report", "notify_slack", "notify_team"] as const;
const automationSchema = z.object({
  name: z.string(),
  trigger: z.enum(TRIGGERS),
  conditions: z.array(z.object({ field: z.enum(FIELDS), op: z.enum(["eq", "gt", "lt", "contains"]), value: z.union([z.string(), z.number()]) })),
  actions: z.array(z.object({ type: z.enum(ACTIONS), to: z.string().optional(), subject: z.string().optional(), message: z.string().optional(), dueInDays: z.number().optional() })).min(1),
});

/* ------------------------------------------------------- 41. Automation builder */

export const automationBuilder = defineAgent({
  name: "automation-builder",
  label: "Automation builder",
  description: "Turns a plain-English request into a trigger, conditions and actions.",
  module: "fabric",
  promptVersion: AUTOMATION_BUILDER_VERSION,
  system: AUTOMATION_BUILDER_SYSTEM,
  model: "fast",
  instruction: "Build the automation described.",
  toolDescription: "Submit the automation.",
  input: z.object({ request: z.string().min(5), triggers: z.array(z.string()), fields: z.array(z.string()), actions: z.array(z.string()) }),
  output: agentCore.extend({ automation: automationSchema, explanation: z.string() }),
  memory: { types: ["analyst_patterns"] },
  sample: { request: "When a Mumbai deal above AED 5M closes, email the compliance officer and create a follow-up task in three days.", triggers: [...TRIGGERS], fields: [...FIELDS], actions: [...ACTIONS] },
  replay: (i) => {
    const r = i.request.toLowerCase();
    const trigger: (typeof TRIGGERS)[number] = /kyc/.test(r) && /expir/.test(r) ? "kyc.expired" : /invoice/.test(r) && /paid|payment/.test(r) ? "invoice.paid" : /commission/.test(r) ? "commission.computed" : /mandate/.test(r) ? "mandate.created" : /stage|moves? to|reaches/.test(r) ? "deal.stage_changed" : "deal.closed";
    const conditions: z.infer<typeof automationSchema>["conditions"] = [];
    const jur = /mumbai/.test(r) ? "mumbai" : /\bgoa\b/.test(r) ? "goa" : /abu dhabi/.test(r) ? "abu_dhabi" : /dubai/.test(r) ? "dubai" : null;
    if (jur) conditions.push({ field: "jurisdiction", op: "eq", value: jur });
    const amt = /(above|over|more than|greater than)\s*(aed\s*)?([\d.,]+)\s*(m|million|k)?/.exec(r);
    if (amt) conditions.push({ field: "deal_value_aed", op: "gt", value: Math.round(Number(amt[3]!.replace(/,/g, "")) * (amt[4]?.startsWith("m") ? 1_000_000 : amt[4] === "k" ? 1_000 : 1)) });
    if (/\bnri\b/.test(r)) conditions.push({ field: "client_residency", op: "contains", value: "NRI" });
    if (/off-?plan/.test(r)) conditions.push({ field: "deal_type", op: "eq", value: "off_plan" });
    const stage = /(contract|signing|payment|negotiation)/.exec(r)?.[1];
    if (trigger === "deal.stage_changed" && stage) conditions.push({ field: "stage", op: "eq", value: stage });
    const actions: z.infer<typeof automationSchema>["actions"] = [];
    if (/email/.test(r)) actions.push({ type: "send_email", to: /client/.test(r) ? "client" : /compliance/.test(r) ? "compliance@firm" : "team@firm", subject: `Automation: ${trigger}` });
    const due = /(\d+|one|two|three|five|seven)\s*(business\s*)?days?/.exec(r);
    if (/task|follow[- ]?up|remind/.test(r)) actions.push({ type: "create_task", dueInDays: due ? (Number(due[1]) || { one: 1, two: 2, three: 3, five: 5, seven: 7 }[due[1] as "one"] || 3) : 3 });
    if (/report/.test(r)) actions.push({ type: "generate_report" });
    if (/slack/.test(r)) actions.push({ type: "notify_slack" });
    if (/notify|alert|tell/.test(r) || !actions.length) actions.push({ type: "notify_team" });
    const name = `${jur ? `${jur.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())} ` : ""}${trigger.replace(".", " ").replace("_", " ")}${amt ? " above threshold" : ""}`.replace(/^./, (c) => c.toUpperCase());
    return {
      headline: `On ${trigger}${conditions.length ? ` when ${conditions.map((c) => `${c.field.replace(/_/g, " ")} ${c.op === "eq" ? "is" : c.op === "gt" ? "is above" : c.op === "lt" ? "is below" : "contains"} ${c.value}`).join(" and ")}` : ""}: ${actions.map((a) => a.type.replace(/_/g, " ")).join(", ")}.`,
      points: [{ label: "Trigger", detail: trigger }, ...conditions.map((c) => ({ label: "Condition", detail: `${c.field} ${c.op} ${c.value}` })), ...actions.map((a) => ({ label: "Action", detail: `${a.type}${a.to ? ` to ${a.to}` : ""}${a.dueInDays ? ` due in ${a.dueInDays} days` : ""}` }))].slice(0, 6),
      confidence: conditions.length || /when|on|if/.test(r) ? 0.82 : 0.6,
      automation: { name, trigger, conditions, actions },
      explanation: "Review the recipients before enabling; the automation runs on every matching event from then on.",
    };
  },
});

/* ------------------------------------------------------ 42. Notification router */

export const notificationRouter = defineAgent({
  name: "notification-router",
  label: "Notification router",
  description: "Decides who needs to know about an event and by which channel, honouring preferences.",
  module: "fabric",
  promptVersion: NOTIFICATION_ROUTER_VERSION,
  system: NOTIFICATION_ROUTER_SYSTEM,
  model: "fast",
  instruction: "Route the notification for this event.",
  toolDescription: "Submit the routing.",
  input: z.object({ event: z.object({ type: z.string(), label: z.string() }), ownerUserId: z.string().nullable(), candidates: z.array(z.object({ userId: z.string(), name: z.string(), accessRole: z.string(), emailOn: z.boolean(), inAppOn: z.boolean() })) }),
  output: agentCore.extend({ priority: z.enum(["high", "normal", "low"]), recipients: z.array(z.object({ userId: z.string(), channel: z.enum(["in_app", "email", "both"]), reason: z.string() })) }),
  memory: { types: ["analyst_patterns"] },
  sample: { event: { type: "invoice.paid", label: "INV-2026-0004 paid" }, ownerUserId: "u2", candidates: [{ userId: "u1", name: "Amol Bandekar", accessRole: "tenant_owner", emailOn: true, inAppOn: true }, { userId: "u2", name: "Aisha Rahman", accessRole: "senior_analyst", emailOn: false, inAppOn: true }, { userId: "u3", name: "Layla Haddad", accessRole: "compliance_officer", emailOn: true, inAppOn: true }] },
  replay: (i) => {
    const money = /invoice|commission/.test(i.event.type);
    const compliance = /kyc|aml/.test(i.event.type);
    const closing = /closed|contract_signed/.test(i.event.type);
    const priority: "high" | "normal" | "low" = compliance ? "high" : closing || money ? "normal" : "low";
    const recipients = i.candidates
      .filter((c) => c.userId === i.ownerUserId || (money && /owner|tenant_admin/.test(c.accessRole)) || (compliance && c.accessRole === "compliance_officer") || (closing && /owner|senior/.test(c.accessRole)))
      .map((c) => {
        const email = c.emailOn || (priority === "high" && compliance);
        return { userId: c.userId, channel: email && c.inAppOn ? ("both" as const) : email ? ("email" as const) : ("in_app" as const), reason: c.userId === i.ownerUserId ? "Owns the deal and acts next." : money ? "Responsible for the firm's revenue." : compliance ? "Compliance owner." : "Approves closings." };
      });
    return { headline: recipients.length ? `Notify ${recipients.map((r) => i.candidates.find((c) => c.userId === r.userId)!.name).join(" and ")} (${priority} priority).` : "No one needs to act on this event.", points: recipients.map((r) => ({ label: i.candidates.find((c) => c.userId === r.userId)!.name, detail: `${r.channel.replace("_", "-")}: ${r.reason}` })).concat(recipients.length ? [] : [{ label: "Event", detail: i.event.label }]), confidence: 0.85, priority, recipients };
  },
});

/* ---------------------------------------------------- 43. Permission suggester */

export const permissionSuggester = defineAgent({
  name: "permission-suggester",
  label: "Permission suggester",
  description: "Suggests the least-privilege access role from what a user actually does.",
  module: "fabric",
  promptVersion: PERMISSION_SUGGESTER_VERSION,
  system: PERMISSION_SUGGESTER_SYSTEM,
  model: "fast",
  instruction: "Suggest the access role for this user.",
  toolDescription: "Submit the suggestion.",
  input: z.object({ userId: z.string(), name: z.string(), title: z.string().nullable(), currentRole: z.string(), activity: z.array(z.object({ action: z.string(), count: z.number() })), refused: z.array(z.object({ action: z.string(), count: z.number() })) }),
  output: agentCore.extend({ suggestedRole: z.string(), change: z.boolean(), rationale: z.string(), risks: z.array(z.string()) }),
  outputEntity: (i) => i.userId,
  memory: { types: ["analyst_patterns"], entity: (i) => i.userId, update: ({ input, memories }) => [{ type: "analyst_patterns", entityId: input.userId, memory: { actions: tally((memories.find((m) => m.scope === "entity")?.memory as { actions?: Record<string, number> } | undefined)?.actions, input.activity.flatMap((a) => Array(Math.min(a.count, 5)).fill(a.action))) } }] },
  sample: { userId: "u1", name: "Rohan Mehta", title: "Analyst, India and Cross-border", currentRole: "analyst", activity: [{ action: "deal offer", count: 9 }, { action: "ran maharera-compliance agent", count: 6 }, { action: "created deal", count: 3 }], refused: [{ action: "deal close", count: 2 }] },
  replay: (i) => {
    const total = (re: RegExp) => i.activity.filter((a) => re.test(a.action)).reduce((x, a) => x + a.count, 0);
    const kyc = total(/kyc|aml/);
    const deals = total(/deal|offer|contract/);
    const approvals = total(/approve|close/);
    const refusedClose = i.refused.filter((r) => /close|approve/.test(r.action)).reduce((x, r) => x + r.count, 0);
    let role = i.currentRole;
    if (kyc > deals && kyc > 5) role = "compliance_officer";
    else if ((approvals > 3 || refusedClose >= 4) && /senior|lead|head|director|partner/i.test(i.title ?? "")) role = "senior_analyst";
    else if (deals > 0 && i.currentRole === "junior_analyst" && deals > 20) role = "analyst";
    const change = role !== i.currentRole;
    return {
      headline: change ? `Change ${i.name} from ${i.currentRole.replace(/_/g, " ")} to ${role.replace(/_/g, " ")}.` : `Keep ${i.name} as ${i.currentRole.replace(/_/g, " ")}${refusedClose ? "; route closings to a senior analyst rather than widening access" : ""}.`,
      points: [{ label: "Activity", detail: i.activity.slice(0, 4).map((a) => `${a.action} (${a.count})`).join(", ") || "None recorded." }, ...(i.refused.length ? [{ label: "Refused", detail: i.refused.map((r) => `${r.action} (${r.count})`).join(", ") }] : [])],
      confidence: i.activity.length ? 0.78 : 0.5,
      suggestedRole: role,
      change,
      rationale: change ? `The work recorded matches the ${role.replace(/_/g, " ")} role.` : "Current access covers the work recorded; least privilege is preserved.",
      risks: role === "senior_analyst" ? ["Senior analysts can close deals and start commission; confirm four-eyes review on large closings."] : role === "compliance_officer" ? ["Separate this user from deal closing to keep duties apart."] : [],
    };
  },
});

/* ------------------------------------------------------------ 44. Audit narrator */

export const auditNarrator = defineAgent({
  name: "audit-narrator",
  label: "Audit narrator",
  description: "Turns an audit trail into a dated account with key events and anomalies.",
  module: "fabric",
  promptVersion: AUDIT_NARRATOR_VERSION,
  system: AUDIT_NARRATOR_SYSTEM,
  model: "fast",
  instruction: "Narrate this audit trail.",
  toolDescription: "Submit the narrative.",
  input: z.object({ scope: z.string(), entries: z.array(z.object({ at: z.string(), actor: z.string(), actorType: z.string(), action: z.string(), costUsd: z.number().nullable() })) }),
  output: agentCore.extend({ narrative: z.string(), keyEvents: z.array(z.object({ at: z.string(), event: z.string() })), anomalies: z.array(z.string()) }),
  outputEntity: (i) => i.scope,
  memory: { types: ["house_style"] },
  sample: { scope: "Deal DL-0002", entries: [{ at: "2026-08-24T09:12:00Z", actor: "Rohan Mehta", actorType: "user", action: "created deal", costUsd: null }, { at: "2026-08-24T09:12:05Z", actor: "deal-predictor agent", actorType: "agent", action: "deal predictor (deal-predictor_v1)", costUsd: 0.004 }, { at: "2026-09-09T22:41:00Z", actor: "Vikram Khanna", actorType: "user", action: "signed contract", costUsd: null }] },
  replay: (i) => {
    const e = [...i.entries].sort((a, b) => a.at.localeCompare(b.at));
    if (!e.length) return { headline: `Nothing is recorded for ${i.scope}.`, points: [{ label: "Entries", detail: "None." }], confidence: 0.9, narrative: "No audit entries in the period.", keyEvents: [], anomalies: [] };
    const humans = e.filter((x) => x.actorType === "user");
    const agents = e.filter((x) => x.actorType === "agent");
    const cost = agents.reduce((a, x) => a + (x.costUsd ?? 0), 0);
    const key = humans.filter((x) => /created|signed|closed|accepted|paid|verified|issued|approved|deleted|exported/.test(x.action));
    const anomalies = [
      ...humans.filter((x) => { const h = new Date(x.at).getUTCHours() + 4; return h % 24 < 6 || h % 24 > 22; }).slice(0, 3).map((x) => `${x.actor} ${x.action} outside business hours (${x.at.slice(0, 16).replace("T", " ")} UTC).`),
      ...(agents.length && cost / agents.length > 0.5 ? [`Average agent cost $${(cost / agents.length).toFixed(2)} a run exceeds the $0.50 target.`] : []),
      ...e.filter((x, k) => /revers|void|withdraw|reject/.test(x.action) && k > 0).slice(0, 2).map((x) => `${x.action} by ${x.actor} at ${x.at.slice(0, 10)}.`),
    ];
    const span = Math.max(1, Math.round((new Date(e.at(-1)!.at).getTime() - new Date(e[0]!.at).getTime()) / 86_400_000));
    return {
      headline: `${i.scope}: ${e.length} entries over ${span} days, ${humans.length} by people and ${agents.length} by agents${anomalies.length ? `; ${anomalies.length} to note` : "; nothing anomalous"}.`,
      points: key.slice(0, 5).map((x) => ({ label: x.at.slice(0, 10), detail: `${x.actor} ${x.action}.` })).concat([{ label: "Agent cost", detail: `$${cost.toFixed(3)} across ${agents.length} runs.` }]).slice(0, 6),
      confidence: 0.88,
      narrative: `Between ${e[0]!.at.slice(0, 10)} and ${e.at(-1)!.at.slice(0, 10)}, ${[...new Set(humans.map((x) => x.actor))].slice(0, 4).join(", ") || "no person"} acted on ${i.scope}. ${key.length ? `Key steps: ${key.slice(0, 4).map((x) => `${x.action} (${x.actor}, ${x.at.slice(0, 10)})`).join("; ")}.` : "No key steps were recorded."} Agents ran ${agents.length} times at a total of $${cost.toFixed(3)}.`,
      keyEvents: key.slice(0, 10).map((x) => ({ at: x.at, event: `${x.actor} ${x.action}` })),
      anomalies,
    };
  },
});

/* --------------------------------------------------------- 45. Data quality agent */

export const dataQualityAgent = defineAgent({
  name: "data-quality-agent",
  label: "Data quality",
  description: "Scores the workspace's data quality and orders the fixes by risk.",
  module: "fabric",
  promptVersion: DATA_QUALITY_VERSION,
  system: DATA_QUALITY_SYSTEM,
  model: "fast",
  instruction: "Score data quality and order the fixes.",
  toolDescription: "Submit the data quality review.",
  input: z.object({ checks: z.array(z.object({ check: z.string(), table: z.string(), severity: z.enum(["HIGH", "MEDIUM", "LOW"]), count: z.number(), examples: z.array(z.string()), fix: z.string() })) }),
  output: agentCore.extend({ score: z.number().min(0).max(100), fixes: z.array(z.object({ order: z.number(), check: z.string(), action: z.string(), where: z.string() })) }),
  memory: { types: ["analyst_patterns"] },
  sample: { checks: [{ check: "Clients without verified KYC", table: "kyc_records", severity: "HIGH", count: 2, examples: ["Priya Sharma", "Fatima Al Suwaidi"], fix: "Request documents through the portal." }, { check: "Active deals past their target close date", table: "deals", severity: "MEDIUM", count: 1, examples: ["DL-0003"], fix: "Update the target date." }] },
  replay: (i) => {
    const cap = { HIGH: [8, 40], MEDIUM: [3, 20], LOW: [1, 10] } as const;
    const score = Math.max(0, 100 - i.checks.reduce((a, c) => a + Math.min(cap[c.severity][1], c.count * cap[c.severity][0]), 0));
    const WHERE: Record<string, string> = { kyc_records: "Administration → KYC and AML", deals: "Deals", india_property_records: "India → Mumbai or Goa", invoices: "Administration → Invoices", documents: "Documents", client_goals: "Clients", };
    const rank = (c: (typeof i.checks)[number]) => (c.table === "kyc_records" ? 0 : c.table === "invoices" ? 1 : c.severity === "HIGH" ? 2 : c.severity === "MEDIUM" ? 3 : 4);
    const fixes = [...i.checks].sort((a, b) => rank(a) - rank(b)).map((c, k) => ({ order: k + 1, check: `${c.check} (${c.count})`, action: c.fix, where: WHERE[c.table] ?? c.table }));
    return { headline: fixes[0] ? `Data quality ${score}: ${fixes[0].check.toLowerCase()} first.` : "Data quality 100: no gaps found.", points: i.checks.slice(0, 6).map((c) => ({ label: `${c.check} (${c.severity})`, detail: `${c.count}${c.examples.length ? `: ${c.examples.join(", ")}` : ""}.` })), confidence: 0.9, score, fixes };
  },
});

export const FABRIC_AGENTS = [automationBuilder, notificationRouter, permissionSuggester, auditNarrator, dataQualityAgent] as const;
export const AUTOMATION_VOCAB = { triggers: [...TRIGGERS], fields: [...FIELDS], actions: [...ACTIONS] };
