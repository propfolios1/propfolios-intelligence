import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { notificationRouter } from "@/lib/ai/os-agents/fabric";
import type { OsEvent } from "@/lib/ai/orchestration/event-bus";
import { DEFAULT_ACCESS } from "@/lib/rbac/permissions";
import { notify } from "./notify";

const CATEGORY: Record<string, "deals" | "commissions" | "kyc" | "system"> = { "deal.contract_signed": "deals", "deal.closed": "deals", "invoice.paid": "commissions", "commission.computed": "commissions" };

/** The notification router chooses recipients and channels for an event; notify() delivers in-app and email accordingly. */
export async function routeEventNotification(db: DB, ev: OsEvent) {
  const staff = await db.select().from(s.users).where(and(eq(s.users.tenantId, ev.tenantId), inArray(s.users.role, ["tenant_admin", "analyst"])));
  const category = CATEGORY[ev.type] ?? "system";
  const prefs = await db.select().from(s.notificationPreferences).where(and(eq(s.notificationPreferences.tenantId, ev.tenantId), eq(s.notificationPreferences.category, category)));
  let owner: string | null = null;
  if (ev.dealId) owner = (await db.select({ o: s.deals.ownerUserId }).from(s.deals).where(eq(s.deals.id, ev.dealId)))[0]?.o ?? null;
  const run = await notificationRouter.run({ event: { type: ev.type, label: String(ev.payload.label ?? ev.type) }, ownerUserId: owner, candidates: staff.map((u) => { const p = prefs.find((x) => x.userId === u.id); return { userId: u.id, name: u.name, accessRole: u.accessRole ?? DEFAULT_ACCESS[u.role as "tenant_admin"], emailOn: p ? p.email : category !== "deals", inAppOn: p ? p.inApp : true }; }) }, { tenantId: ev.tenantId, actor: `Event: ${ev.type}` });
  const ids = run.output.recipients.map((r) => r.userId);
  if (ids.length) await notify(db, { tenantId: ev.tenantId, userIds: ids, category, title: String(ev.payload.label ?? ev.type), body: run.output.headline, href: typeof ev.payload.href === "string" ? ev.payload.href : undefined, priority: run.output.priority });
  return { costUsd: run.costUsd, summary: run.output.headline };
}
