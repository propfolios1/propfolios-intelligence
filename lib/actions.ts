import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { desc, eq, inArray, ne } from "drizzle-orm";
import type { z } from "zod";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { payload, runAgent } from "@/lib/ai/agents/_run";
import type { AgentContext } from "@/lib/ai/client";
import { ACTION_PROMPT_VERSION, ACTION_SYSTEM } from "@/lib/ai/prompts/action_v1";
import { actionPlanOutput, type actionPlanInput } from "@/lib/ai/schemas";
import { audit } from "@/lib/api";
import { HttpError, type CurrentUser } from "@/lib/auth";
import { getTenantById } from "@/lib/tenant";
import { scope } from "@/lib/tenant-db";

export type ActionKind = (typeof s.actionKindEnum.enumValues)[number];

export const ACTION_LABEL: Record<ActionKind, string> = {
  rent_reminder: "Rent reminder",
  send_memo: "Send memo to client",
  schedule_follow_up: "Schedule follow-up",
  send_dd_to_lender: "Send due diligence to lender",
  update_crm: "Update client record",
  esign_envelope: "Signature envelope",
  escalate: "Escalate to senior analyst",
};

type Plan = z.infer<typeof actionPlanOutput>;
type PlanInput = z.infer<typeof actionPlanInput>;

/** Replay operations lead: the rules in the prompt, applied in order. */
export function replayPlan(i: PlanInput): Plan {
  const actions: Plan["actions"] = [];
  if (i.mandate.requiresReview) {
    actions.push({ kind: "escalate", title: "Escalate the model disagreement", rationale: "Cross-validation did not reach a unanimous verdict; a senior analyst should decide before the memo is approved.", params: {} });
  }
  if (i.client.kycStatus !== "verified") {
    actions.push({ kind: "update_crm", title: "Request outstanding KYC documents", rationale: `KYC status is "${i.client.kycStatus}"; client-facing steps wait on verification.`, params: { note: "KYC documents requested" } });
  }
  if (i.memo && (i.memo.status === "approved" || i.memo.status === "delivered") && !i.memo.shared) {
    actions.push({ kind: "send_memo", title: `Share the memo with ${i.client.name}`, rationale: "The memo is approved and not yet visible in the client portal.", params: {} });
    actions.push({ kind: "esign_envelope", title: "Request the client's signed instruction", rationale: "A signed acknowledgement of the memo is the instruction to proceed with the allocation.", params: {} });
  }
  if (i.financing) {
    actions.push({ kind: "send_dd_to_lender", title: "Send due diligence findings to the lender", rationale: "The brief refers to financing; the lender's credit team needs the findings before an offer.", params: { recipient: "Lender credit team", dueInDays: 14 } });
  }
  if (i.mandate.status === "REVIEW") {
    actions.push({ kind: "schedule_follow_up", title: "Complete the committee review", rationale: "The memo is awaiting approval.", params: { dueInDays: i.mandate.requiresReview ? 2 : 3, note: "Committee review" } });
  } else if (i.mandate.status === "DELIVERED") {
    actions.push({ kind: "schedule_follow_up", title: "Confirm the client's instruction", rationale: "Delivered memos are followed up within a week.", params: { dueInDays: 7, note: "Client instruction" } });
  }
  for (const h of i.holdings.filter((x) => x.daysOverdue > 7)) {
    actions.push({ kind: "rent_reminder", title: `Rent reminder: ${h.property}`, rationale: `AED ${h.rentDueAed.toLocaleString("en-US")} is ${h.daysOverdue} days overdue.`, params: { note: h.property } });
  }
  return { actions: actions.slice(0, 6) };
}

/**
 * Layer 5: the action agent proposes follow-up actions for a mandate. They are
 * stored as proposals; nothing runs until a person executes it.
 */
export async function proposeActions(db: DB, tenantId: string, mandateId: string, ctx: AgentContext, asStatus?: string) {
  const [row] = await db
    .select({ m: s.mandates, client: s.clients })
    .from(s.mandates)
    .innerJoin(s.clients, eq(s.clients.id, s.mandates.clientId))
    .where(scope(s.mandates, tenantId, eq(s.mandates.id, mandateId)))
    .limit(1);
  if (!row) throw new HttpError(404, "Mandate not found.");
  const [memo] = await db.select().from(s.memos).where(scope(s.memos, tenantId, eq(s.memos.mandateId, mandateId))).limit(1);
  const findings = (row.m.ddFindings ?? []) as { severity: string; category: string; title: string }[];
  const input: PlanInput = {
    mandate: { reference: row.m.reference, title: row.m.title, status: asStatus ?? row.m.status, objective: row.m.objective, recommendation: row.m.recommendation, requiresReview: row.m.requiresReview },
    client: { name: row.client.name, kycStatus: row.client.kycStatus },
    memo: memo ? { status: memo.status, shared: Boolean(memo.sharedAt) } : null,
    findings: findings.map((f) => ({ severity: f.severity, category: f.category, title: f.title })),
    financing: /\b(lender|mortgage|financ|loan|leverage)/i.test(`${row.m.brief} ${row.m.objective}`),
    holdings: [],
  };
  const run = await runAgent({
    agent: "action",
    action: `action plan (${ACTION_PROMPT_VERSION})`,
    model: "fast",
    system: ACTION_SYSTEM,
    user: payload("Propose the follow-up actions.", input),
    schema: actionPlanOutput,
    toolName: "propose_actions",
    toolDescription: "Propose follow-up actions for approval.",
    ctx: { ...ctx, mandateId },
    replay: () => replayPlan(input),
    replayMs: 600,
  });
  const open = await db
    .select({ kind: s.actions.kind })
    .from(s.actions)
    .where(scope(s.actions, tenantId, eq(s.actions.mandateId, mandateId), inArray(s.actions.status, ["proposed", "executed"])));
  const have = new Set(open.map((a) => a.kind));
  const fresh = run.output.actions.filter((a) => a.kind === "schedule_follow_up" || !have.has(a.kind));
  if (!fresh.length) return [];
  return db
    .insert(s.actions)
    .values(fresh.map((a) => ({ tenantId, mandateId, clientId: row.m.clientId, kind: a.kind, title: a.title, rationale: a.rationale, payload: a.params, proposedBy: run.replay ? "Action agent (replay)" : `Action agent (${run.model})` })))
    .returning();
}

/** A person proposes an action directly (for example a rent reminder). */
export async function createAction(db: DB, user: CurrentUser, input: { kind: ActionKind; mandateId?: string | null; clientId?: string | null; title: string; rationale: string; payload: Record<string, unknown> }) {
  if (input.mandateId) {
    const [m] = await db.select({ id: s.mandates.id, clientId: s.mandates.clientId }).from(s.mandates).where(scope(s.mandates, user.tenantId, eq(s.mandates.id, input.mandateId))).limit(1);
    if (!m) throw new HttpError(404, "Mandate not found.");
    input.clientId ??= m.clientId;
  }
  if (input.clientId) {
    const [c] = await db.select({ id: s.clients.id }).from(s.clients).where(scope(s.clients, user.tenantId, eq(s.clients.id, input.clientId))).limit(1);
    if (!c) throw new HttpError(404, "Client not found.");
  }
  const [row] = await db
    .insert(s.actions)
    .values({ tenantId: user.tenantId, mandateId: input.mandateId ?? null, clientId: input.clientId ?? null, kind: input.kind, title: input.title, rationale: input.rationale, payload: input.payload, proposedBy: user.name })
    .returning();
  await audit(user, `proposed action: ${ACTION_LABEL[input.kind].toLowerCase()}`, { entityType: "action", entityId: row!.id, mandateId: input.mandateId ?? undefined });
  return row!;
}

async function loadAction(db: DB, tenantId: string, id: string) {
  const [a] = await db.select().from(s.actions).where(scope(s.actions, tenantId, eq(s.actions.id, id))).limit(1);
  if (!a) throw new HttpError(404, "Action not found.");
  return a;
}

const authorRole = (u: CurrentUser) => (u.role === "tenant_admin" ? ("tenant_admin" as const) : ("analyst" as const));
const days = (n: number) => new Date(Date.now() + n * 86_400_000);
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Executes an approved action and records exactly what changed. */
export async function executeAction(db: DB, user: CurrentUser, id: string, appUrl: string) {
  const a = await loadAction(db, user.tenantId, id);
  if (a.status !== "proposed" && a.status !== "failed") throw new HttpError(409, `This action is ${a.status}.`);
  const p = a.payload as { dueInDays?: number; recipient?: string; note?: string; amountAed?: number; property?: string };
  let result: Record<string, unknown>;
  try {
    result = await perform(db, user, a, p, appUrl);
  } catch (e) {
    const message = e instanceof HttpError ? e.message : (e as Error).message;
    await db.update(s.actions).set({ status: "failed", error: message }).where(eq(s.actions.id, a.id));
    await audit(user, `action failed: ${ACTION_LABEL[a.kind].toLowerCase()}`, { entityType: "action", entityId: a.id, mandateId: a.mandateId ?? undefined, detail: { error: message } });
    throw e instanceof HttpError ? e : new HttpError(422, message);
  }
  const [row] = await db.update(s.actions).set({ status: "executed", executedBy: user.name, executedAt: new Date(), result, error: null }).where(eq(s.actions.id, a.id)).returning();
  await audit(user, `executed action: ${ACTION_LABEL[a.kind].toLowerCase()}`, { entityType: "action", entityId: a.id, mandateId: a.mandateId ?? undefined, detail: result });
  return row!;
}

async function perform(db: DB, user: CurrentUser, a: typeof s.actions.$inferSelect, p: { dueInDays?: number; recipient?: string; note?: string; amountAed?: number; property?: string }, appUrl: string): Promise<Record<string, unknown>> {
  const tenantId = user.tenantId;
  const needClient = () => {
    if (!a.clientId) throw new HttpError(422, "This action needs a client.");
    return a.clientId;
  };
  const needMandate = () => {
    if (!a.mandateId) throw new HttpError(422, "This action needs a mandate.");
    return a.mandateId;
  };
  const message = async (clientId: string, body: string) => {
    const [m] = await db.insert(s.messages).values({ tenantId, clientId, authorName: user.name, authorRole: authorRole(user), body }).returning({ id: s.messages.id });
    return m!.id;
  };

  switch (a.kind) {
    case "send_memo": {
      const clientId = needClient();
      const [memo] = await db.select().from(s.memos).where(scope(s.memos, tenantId, eq(s.memos.mandateId, needMandate()))).limit(1);
      if (!memo || (memo.status !== "approved" && memo.status !== "delivered")) throw new HttpError(409, "Approve the memo before sharing it.");
      if (memo.sharedAt) throw new HttpError(409, "The memo is already shared.");
      const [existing] = await db.select({ id: s.documents.id }).from(s.documents).where(scope(s.documents, tenantId, eq(s.documents.mandateId, memo.mandateId), eq(s.documents.type, "memo"))).limit(1);
      let documentId = existing?.id ?? null;
      let createdDocument = false;
      if (!documentId) {
        const text = memo.contentHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const [d] = await db
          .insert(s.documents)
          .values({ tenantId, clientId, mandateId: memo.mandateId, title: memo.title, type: "memo", pages: Math.max(2, Math.ceil(text.length / 3200)), sizeBytes: Math.round(text.length * 1.6), contentText: text })
          .returning({ id: s.documents.id });
        documentId = d!.id;
        createdDocument = true;
      }
      await db.update(s.memos).set({ sharedAt: new Date() }).where(eq(s.memos.id, memo.id));
      const messageId = await message(clientId, `Your ${memo.title} is now available under Documents. We would be glad to take you through it at your convenience.`);
      return { memoId: memo.id, documentId, createdDocument, messageId };
    }
    case "esign_envelope": {
      const clientId = needClient();
      const [memo] = await db.select().from(s.memos).where(scope(s.memos, tenantId, eq(s.memos.mandateId, needMandate()))).limit(1);
      if (!memo || (memo.status !== "approved" && memo.status !== "delivered")) throw new HttpError(409, "Approve the memo before requesting a signature.");
      const tenant = await getTenantById(tenantId);
      const [env] = await db
        .insert(s.signatureEnvelopes)
        .values({
          tenantId,
          clientId,
          mandateId: memo.mandateId,
          memoId: memo.id,
          title: `Instruction: ${memo.title}`,
          statement: `I have read the ${memo.title} prepared by ${tenant?.configJson.brand_name ?? "the firm"} (version ${memo.version}) and instruct the firm to proceed on the terms and conditions it sets out.`,
        })
        .returning({ id: s.signatureEnvelopes.id });
      const messageId = await message(clientId, `A signature request is waiting under Documents: your instruction to proceed on the ${memo.title}. It takes a minute to review and sign.`);
      return { envelopeId: env!.id, messageId };
    }
    case "schedule_follow_up": {
      const due = days(p.dueInDays ?? 7);
      const [ins] = await db
        .insert(s.insights)
        .values({ tenantId, clientId: a.clientId, mandateId: a.mandateId, kind: "follow_up", severity: "MEDIUM", audience: "analyst", title: a.title, body: `${a.rationale} Due ${due.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`, dedupeKey: `follow_up:${a.id}`, dueAt: due })
        .returning({ id: s.insights.id });
      return { insightId: ins!.id, dueAt: due.toISOString() };
    }
    case "send_dd_to_lender": {
      const mandateId = needMandate();
      const token = randomBytes(24).toString("base64url");
      const expiresAt = days(p.dueInDays ?? 14);
      const [link] = await db.insert(s.shareLinks).values({ tenantId, mandateId, kind: "dd_report", tokenHash: hashToken(token), recipient: p.recipient ?? "Lender", expiresAt }).returning({ id: s.shareLinks.id });
      return { shareLinkId: link!.id, url: `${appUrl}/share/${token}`, recipient: p.recipient ?? "Lender", expiresAt: expiresAt.toISOString() };
    }
    case "update_crm": {
      const clientId = needClient();
      const [c] = await db.select().from(s.clients).where(scope(s.clients, tenantId, eq(s.clients.id, clientId))).limit(1);
      if (!c) throw new HttpError(404, "Client not found.");
      const before = { kycStatus: c.kycStatus, notes: c.policy.notes ?? null };
      const stamp = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
      const note = `${stamp}: ${p.note ?? a.title}`;
      const kycStatus = c.kycStatus === "verified" ? c.kycStatus : "documents requested";
      await db.update(s.clients).set({ kycStatus, policy: { ...c.policy, notes: before.notes ? `${before.notes} ${note}` : note } }).where(eq(s.clients.id, clientId));
      return { clientId, before, after: { kycStatus, note } };
    }
    case "escalate": {
      const mandateId = needMandate();
      const [m] = await db.select({ analystId: s.mandates.analystId }).from(s.mandates).where(scope(s.mandates, tenantId, eq(s.mandates.id, mandateId))).limit(1);
      const staff = await db.select().from(s.users).where(scope(s.users, tenantId, inArray(s.users.role, ["tenant_admin", "analyst"]), m?.analystId ? ne(s.users.id, m.analystId) : undefined));
      const senior = staff.find((u) => /senior|head|director|partner/i.test(u.title ?? "")) ?? staff.find((u) => u.role === "tenant_admin");
      if (!senior) throw new HttpError(409, "There is no other senior team member to escalate to.");
      await db.update(s.mandates).set({ analystId: senior.id }).where(eq(s.mandates.id, mandateId));
      const [ins] = await db
        .insert(s.insights)
        .values({ tenantId, mandateId, clientId: a.clientId, kind: "follow_up", severity: "HIGH", audience: "analyst", title: `Escalated to ${senior.name}`, body: a.rationale, dedupeKey: `escalate:${a.id}`, dueAt: days(2) })
        .returning({ id: s.insights.id });
      return { previousAnalystId: m?.analystId ?? null, newAnalystId: senior.id, newAnalystName: senior.name, insightId: ins!.id };
    }
    case "rent_reminder": {
      const clientId = needClient();
      const tenant = await getTenantById(tenantId);
      const pay = tenant?.configJson.payments;
      const how = pay?.link ? `You can settle it here: ${pay.link}` : pay?.instructions ? `Payment instructions: ${pay.instructions}` : "Your relationship manager will send payment instructions on request.";
      const amount = p.amountAed ? `AED ${p.amountAed.toLocaleString("en-US")} ` : "";
      const messageId = await message(clientId, `A reminder that ${amount}rent${p.property ? ` on ${p.property}` : ""} is outstanding. ${how}`);
      return { messageId };
    }
  }
}

/** Reverses an executed action from its recorded result. */
export async function reverseAction(db: DB, user: CurrentUser, id: string) {
  const a = await loadAction(db, user.tenantId, id);
  if (a.status !== "executed") throw new HttpError(409, "Only executed actions can be reversed.");
  const r = (a.result ?? {}) as Record<string, string | boolean | null | { kycStatus: string; notes: string | null }>;
  const tenantId = user.tenantId;
  switch (a.kind) {
    case "send_memo":
      if (r.messageId) await db.delete(s.messages).where(scope(s.messages, tenantId, eq(s.messages.id, r.messageId as string)));
      if (r.memoId) await db.update(s.memos).set({ sharedAt: null }).where(scope(s.memos, tenantId, eq(s.memos.id, r.memoId as string)));
      if (r.createdDocument && r.documentId) await db.delete(s.documents).where(scope(s.documents, tenantId, eq(s.documents.id, r.documentId as string)));
      break;
    case "esign_envelope": {
      const [env] = await db.select().from(s.signatureEnvelopes).where(scope(s.signatureEnvelopes, tenantId, eq(s.signatureEnvelopes.id, r.envelopeId as string))).limit(1);
      if (env?.status === "signed") throw new HttpError(409, "The client has signed this envelope; it cannot be withdrawn.");
      if (env) await db.update(s.signatureEnvelopes).set({ status: "voided" }).where(eq(s.signatureEnvelopes.id, env.id));
      if (r.messageId) await db.delete(s.messages).where(scope(s.messages, tenantId, eq(s.messages.id, r.messageId as string)));
      break;
    }
    case "schedule_follow_up":
      if (r.insightId) await db.delete(s.insights).where(scope(s.insights, tenantId, eq(s.insights.id, r.insightId as string)));
      break;
    case "send_dd_to_lender":
      if (r.shareLinkId) await db.update(s.shareLinks).set({ revokedAt: new Date() }).where(scope(s.shareLinks, tenantId, eq(s.shareLinks.id, r.shareLinkId as string)));
      break;
    case "update_crm": {
      const before = r.before as { kycStatus: string; notes: string | null };
      const [c] = await db.select().from(s.clients).where(scope(s.clients, tenantId, eq(s.clients.id, r.clientId as string))).limit(1);
      if (c) await db.update(s.clients).set({ kycStatus: before.kycStatus, policy: { ...c.policy, notes: before.notes ?? undefined } }).where(eq(s.clients.id, c.id));
      break;
    }
    case "escalate":
      if (a.mandateId) await db.update(s.mandates).set({ analystId: (r.previousAnalystId as string | null) ?? null }).where(scope(s.mandates, tenantId, eq(s.mandates.id, a.mandateId)));
      if (r.insightId) await db.delete(s.insights).where(scope(s.insights, tenantId, eq(s.insights.id, r.insightId as string)));
      break;
    case "rent_reminder":
      if (r.messageId) await db.delete(s.messages).where(scope(s.messages, tenantId, eq(s.messages.id, r.messageId as string)));
      break;
  }
  const [row] = await db.update(s.actions).set({ status: "reversed", reversedBy: user.name, reversedAt: new Date() }).where(eq(s.actions.id, a.id)).returning();
  await audit(user, `reversed action: ${ACTION_LABEL[a.kind].toLowerCase()}`, { entityType: "action", entityId: a.id, mandateId: a.mandateId ?? undefined });
  return row!;
}

export async function dismissAction(db: DB, user: CurrentUser, id: string) {
  const a = await loadAction(db, user.tenantId, id);
  if (a.status !== "proposed") throw new HttpError(409, "Only proposed actions can be dismissed.");
  const [row] = await db.update(s.actions).set({ status: "dismissed", reversedBy: user.name, reversedAt: new Date() }).where(eq(s.actions.id, a.id)).returning();
  await audit(user, `dismissed action: ${ACTION_LABEL[a.kind].toLowerCase()}`, { entityType: "action", entityId: a.id, mandateId: a.mandateId ?? undefined });
  return row!;
}

export async function listActions(db: DB, tenantId: string, filter: { mandateId?: string; status?: (typeof s.actionStatusEnum.enumValues)[number][] } = {}) {
  return db
    .select()
    .from(s.actions)
    .where(scope(s.actions, tenantId, filter.mandateId ? eq(s.actions.mandateId, filter.mandateId) : undefined, filter.status ? inArray(s.actions.status, filter.status) : undefined))
    .orderBy(desc(s.actions.createdAt))
    .limit(200);
}

