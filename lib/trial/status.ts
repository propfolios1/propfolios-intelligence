import "server-only";
import { eq } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { TrialState } from "@/db/schema-production";

export const TRIAL_DAYS = 14;
export const READ_ONLY_UNTIL_DAY = 30;
export const PURGE_DAY = 60;
const DAY = 86_400_000;

export type TrialStatus = { state: TrialState; startedAt: Date; daysUsed: number; daysRemaining: number; readOnlyEndsAt: Date; purgeAt: Date };

/** The tenant's trial position, or null when it is not on a trial. */
export async function trialStatus(db: DB, tenantId: string, now = Date.now()): Promise<TrialStatus | null> {
  const [row] = await db.select().from(s.trialLifecycle).where(eq(s.trialLifecycle.tenantId, tenantId));
  if (!row || row.state === "converted") return null;
  const daysUsed = Math.floor((now - row.startedAt.getTime()) / DAY);
  return { state: row.state, startedAt: row.startedAt, daysUsed, daysRemaining: Math.max(0, TRIAL_DAYS - daysUsed), readOnlyEndsAt: new Date(row.startedAt.getTime() + READ_ONLY_UNTIL_DAY * DAY), purgeAt: new Date(row.startedAt.getTime() + PURGE_DAY * DAY) };
}

/** Lifecycle position for a trial of a given age: pure, so the schedule can be tested without a clock. */
export function stateForDay(day: number): Exclude<TrialState, "converted"> {
  if (day >= PURGE_DAY) return "purged";
  if (day >= READ_ONLY_UNTIL_DAY) return "soft_deleted";
  if (day >= TRIAL_DAYS) return "read_only";
  return "active";
}

/** Notices sent once each, by trial day. */
export const NOTICES: { day: number; event: string; subject: (firm: string) => string; body: (firm: string, url: string) => string }[] = [
  { day: 10, event: "notice_day_10", subject: (f) => `${f}: four days remain in your Nakhla trial`, body: (f, u) => `Your ${f} trial has four days remaining. Everything you have built stays in place when you upgrade, including imported records and portal connections.\n\nUpgrade: ${u}/admin/upgrade` },
  { day: 13, event: "notice_day_13", subject: (f) => `${f}: your Nakhla trial ends tomorrow`, body: (f, u) => `The ${f} trial ends tomorrow. From then the workspace is read-only until you upgrade; nothing is deleted for 30 days.\n\nUpgrade: ${u}/admin/upgrade` },
  { day: 14, event: "notice_day_14", subject: (f) => `${f}: your workspace is now read-only`, body: (f, u) => `The ${f} trial has ended. You and your team can still sign in and read every record; changes resume as soon as you upgrade. The workspace is kept until day 30, then held for recovery by support until day 60.\n\nUpgrade: ${u}/admin/upgrade` },
  { day: 29, event: "notice_day_29", subject: (f) => `${f}: the workspace closes tomorrow`, body: (f, u) => `Tomorrow the ${f} workspace closes. Support can restore it on request until day 60, after which the data is permanently deleted. Upgrade today to keep working without interruption.\n\nUpgrade: ${u}/admin/upgrade` },
];
