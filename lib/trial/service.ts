import "server-only";
import { and, eq, inArray, like, notInArray, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { seedMarketWorkspace } from "@/db/seed-market";
import { clerkEnabled, HttpError } from "@/lib/auth";
import { MARKETS, type MarketCode } from "@/lib/markets";
import { sendEmail } from "@/lib/os/notify";
import { planById, type PlanId } from "@/lib/plans";
import { defaultTenantConfig, slugify } from "@/lib/tenant";
import { NOTICES, stateForDay, TRIAL_DAYS, READ_ONLY_UNTIL_DAY, PURGE_DAY } from "./status";

/**
 * Self-serve trials. One trial per email address. A trial is a real tenant on
 * the Professional plan, seeded with a working brokerage in the firm's
 * country, that moves through full access (days 0 to 14), read-only (14 to
 * 30), soft-deleted and recoverable by support (30 to 60) and purged (day 60
 * on). Converting keeps the same tenant and every record in it.
 */

const DAY = 86_400_000;
export const TRIAL_COUNTRIES = [...(Object.keys(MARKETS) as MarketCode[]).map((c) => ({ code: c, name: MARKETS[c].name })), { code: "OTHER", name: "Another country" }];
export const MAX_TEAMMATES = 3;
const SEEDED_DOMAIN = "demo.nakhla.ai";

export type TrialInput = { email: string; name: string; firmName: string; country: string; agentCount: number };

async function uniqueSlug(db: DB, base: string) {
  const root = slugify(base) || "firm";
  const taken = new Set((await db.select({ slug: s.tenants.slug }).from(s.tenants).where(like(s.tenants.slug, `${root}%`))).map((r) => r.slug));
  if (!taken.has(root) && !["nakhla", "platform", "admin", "api", "www", "app", "trial"].includes(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

async function event(db: DB, signupId: string, tenantId: string | null, eventType: string, metadata: Record<string, unknown> = {}) {
  const rows = await db.insert(s.trialEvents).values({ trialSignupId: signupId, tenantId, eventType, metadata }).onConflictDoNothing().returning({ id: s.trialEvents.id });
  return rows.length > 0;
}

export async function startTrial(db: DB, input: TrialInput, opts: { appUrl?: string | null; now?: number } = {}) {
  const email = input.email.trim().toLowerCase();
  const [signedUp] = await db.select({ id: s.trialSignups.id }).from(s.trialSignups).where(eq(s.trialSignups.email, email));
  const [user] = await db.select({ id: s.users.id }).from(s.users).where(eq(sql`lower(${s.users.email})`, email)).limit(1);
  if (signedUp || user) throw new HttpError(409, "You already have a trial. Log in.");
  const now = opts.now ?? Date.now();
  const started = Date.now();
  const market = (input.country in MARKETS ? input.country : "AE") as MarketCode;
  const [signup] = await db.insert(s.trialSignups).values({ email, name: input.name.trim(), firmName: input.firmName.trim(), country: input.country, agentCount: input.agentCount }).returning();
  const plan = planById("professional");
  const slug = await uniqueSlug(db, input.firmName);
  let clerkOrgId: string | null = null;
  if (clerkEnabled) {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const clerk = await clerkClient();
    const org = await clerk.organizations.createOrganization({ name: input.firmName.trim(), slug });
    clerkOrgId = org.id;
    // The invitation email is the sign-in link: it lands on sign-up with the address prefilled and joins the organisation.
    await clerk.organizations.createOrganizationInvitation({ organizationId: org.id, emailAddress: email, role: "org:admin", redirectUrl: opts.appUrl ? `${opts.appUrl}/trial/welcome` : undefined });
  }
  const [tenant] = await db
    .insert(s.tenants)
    .values({ name: input.firmName.trim(), slug, clerkOrgId, configJson: defaultTenantConfig(input.firmName.trim()), plan: plan.id, status: "trial", createdAt: new Date(now) })
    .returning();
  const tenantId = tenant!.id;
  await db.insert(s.subscriptions).values({ tenantId, plan: plan.id, status: "trialing", seats: plan.seats, priceAed: plan.priceAed, startedAt: new Date(now), currentPeriodEnd: new Date(now + TRIAL_DAYS * DAY) });
  const [admin] = await db
    .insert(s.users)
    .values({ tenantId, email, name: input.name.trim(), title: "Managing Director", role: "tenant_admin", accessRole: "tenant_owner", invitedAt: clerkEnabled ? new Date(now) : null, lastActiveAt: clerkEnabled ? null : new Date(now), preferences: { digest: "weekly", alerts: true, currency: market === "IN" ? "INR" : market === "AE" ? "AED" : "USD" } })
    .returning();
  await db.update(s.trialSignups).set({ tenantId }).where(eq(s.trialSignups.id, signup!.id));
  await event(db, signup!.id, tenantId, "signup_created", { country: input.country, agentCount: input.agentCount });
  const counts = await seedMarketWorkspace(db, { tenantId, key: signup!.id, market, adminUserId: admin!.id, adminName: admin!.name, domain: SEEDED_DOMAIN, now });
  const seededIn = Date.now() - started;
  await db.update(s.trialSignups).set({ seededIn }).where(eq(s.trialSignups.id, signup!.id));
  await db.insert(s.trialLifecycle).values({ tenantId, trialSignupId: signup!.id, state: "active", startedAt: new Date(now), enteredAt: new Date(now), nextTransitionAt: new Date(now + TRIAL_DAYS * DAY) });
  await event(db, signup!.id, tenantId, "workspace_seeded", { ms: seededIn, market, ...counts });
  await db.insert(s.auditLogs).values({ tenantId, userId: admin!.id, actorName: admin!.name, actorType: "user", action: `started a ${TRIAL_DAYS}-day trial`, entityType: "tenant", entityId: tenantId, detail: { country: input.country, agents: input.agentCount, seededInMs: seededIn } });
  return { signupId: signup!.id, tenantId, slug, adminUserId: admin!.id, seededInMs: seededIn, counts };
}

/** Advances every trial to the state its age calls for and sends due notices once. Idempotent. */
export async function advanceTrials(db: DB, opts: { now?: number; appUrl?: string | null; tenantIds?: string[] } = {}) {
  const now = opts.now ?? Date.now();
  const appUrl = opts.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const rows = await db.select().from(s.trialLifecycle).where(and(notInArray(s.trialLifecycle.state, ["converted", "purged"]), opts.tenantIds ? inArray(s.trialLifecycle.tenantId, opts.tenantIds) : undefined));
  const summary = { checked: rows.length, notices: 0, readOnly: 0, softDeleted: 0, purged: 0 };
  for (const r of rows) {
    const day = Math.floor((now - r.startedAt.getTime()) / DAY);
    const [tenant] = await db.select({ name: s.tenants.name, status: s.tenants.status }).from(s.tenants).where(eq(s.tenants.id, r.tenantId));
    if (!tenant) continue;
    const signupId = r.trialSignupId;
    const [signup] = signupId ? await db.select().from(s.trialSignups).where(eq(s.trialSignups.id, signupId)) : [];
    // After a gap (a paused scheduler, a restored trial) only the latest due notice is sent; earlier ones are recorded as superseded.
    const due = signup && day < PURGE_DAY ? NOTICES.filter((n) => day >= n.day) : [];
    for (const [k, n] of due.entries()) {
      const latest = k === due.length - 1;
      if ((await event(db, signup!.id, r.tenantId, n.event, { day, superseded: !latest })) && latest) {
        await sendEmail(db, { tenantId: r.tenantId, to: signup!.email, subject: n.subject(tenant.name), text: n.body(tenant.name, appUrl) });
        summary.notices++;
      }
    }
    const target = stateForDay(day);
    if (target === r.state) continue;
    if (target === "purged") {
      // Hard delete: the tenant row cascades to every record it owns.
      if (signup) await event(db, signup.id, null, "purged", { day });
      await db.delete(s.tenants).where(eq(s.tenants.id, r.tenantId));
      summary.purged++;
      continue;
    }
    const next = target === "read_only" ? READ_ONLY_UNTIL_DAY : target === "soft_deleted" ? PURGE_DAY : TRIAL_DAYS;
    await db.update(s.trialLifecycle).set({ state: target, enteredAt: new Date(now), nextTransitionAt: new Date(r.startedAt.getTime() + next * DAY) }).where(eq(s.trialLifecycle.id, r.id));
    if (target === "soft_deleted") await db.update(s.tenants).set({ status: "suspended" }).where(eq(s.tenants.id, r.tenantId));
    if (signup) await event(db, signup.id, r.tenantId, `entered_${target}`, { day });
    await db.insert(s.auditLogs).values({ tenantId: r.tenantId, actorName: "Trial lifecycle", actorType: "system", action: target === "read_only" ? "trial ended: workspace is read-only" : "trial closed: workspace soft-deleted and held for recovery", entityType: "tenant", entityId: r.tenantId });
    if (target === "read_only") summary.readOnly++;
    else summary.softDeleted++;
  }
  return summary;
}

/** Trial to paid in place: the same tenant, records and users. */
export async function convertTrial(db: DB, tenantId: string, planId: PlanId, actor: string, ref?: string | null) {
  const plan = planById(planId);
  const [lc] = await db.select().from(s.trialLifecycle).where(eq(s.trialLifecycle.tenantId, tenantId));
  await db.update(s.tenants).set({ status: "active", plan: plan.id }).where(eq(s.tenants.id, tenantId));
  await db.update(s.subscriptions).set({ plan: plan.id, status: "active", seats: plan.seats, priceAed: plan.priceAed, currentPeriodEnd: new Date(Date.now() + 30 * DAY) }).where(eq(s.subscriptions.tenantId, tenantId));
  if (lc) {
    await db.update(s.trialLifecycle).set({ state: "converted", enteredAt: new Date(), nextTransitionAt: null }).where(eq(s.trialLifecycle.id, lc.id));
    if (lc.trialSignupId) {
      await db.update(s.trialSignups).set({ convertedAt: new Date() }).where(eq(s.trialSignups.id, lc.trialSignupId));
      await event(db, lc.trialSignupId, tenantId, "converted", { plan: plan.id, ref: ref ?? null });
    }
  }
  await db.insert(s.auditLogs).values({ tenantId, actorName: actor, actorType: "user", action: `upgraded to the ${plan.name} plan`, entityType: "tenant", entityId: tenantId, detail: { reference: ref ?? null } });
}

/** Support recovery of a soft-deleted trial: back to read-only, so the firm can sign in and upgrade. */
export async function restoreTrial(db: DB, tenantId: string, actor: string) {
  const [lc] = await db.select().from(s.trialLifecycle).where(eq(s.trialLifecycle.tenantId, tenantId));
  if (!lc || lc.state !== "soft_deleted") throw new HttpError(409, "Only a soft-deleted trial can be restored.");
  await db.update(s.tenants).set({ status: "trial" }).where(eq(s.tenants.id, tenantId));
  await db.update(s.trialLifecycle).set({ state: "read_only", enteredAt: new Date(), nextTransitionAt: new Date(lc.startedAt.getTime() + PURGE_DAY * DAY) }).where(eq(s.trialLifecycle.id, lc.id));
  await db.insert(s.auditLogs).values({ tenantId, actorName: actor, actorType: "user", action: "restored the trial workspace from soft deletion", entityType: "tenant", entityId: tenantId });
}

/** Teammates during a trial: up to three, on the same trial clock. */
export async function inviteTeammates(db: DB, tenantId: string, emails: string[], actor: { id: string; name: string }) {
  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const staff = await db.select({ email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, tenantId), inArray(s.users.role, ["tenant_admin", "analyst"])));
  const real = staff.filter((u) => !u.email.endsWith(`@${SEEDED_DOMAIN}`));
  const already = new Set(staff.map((u) => u.email.toLowerCase()));
  const fresh = clean.filter((e) => !already.has(e));
  // The founder is not a teammate; seeded demonstration agents are not counted.
  const teammates = Math.max(0, real.length - 1);
  if (teammates + fresh.length > MAX_TEAMMATES) throw new HttpError(402, `A trial includes up to ${MAX_TEAMMATES} teammates; ${teammates} ${teammates === 1 ? "is" : "are"} already invited. Upgrade to add more.`);
  const [taken] = fresh.length ? await db.select({ email: s.users.email }).from(s.users).where(inArray(sql`lower(${s.users.email})`, fresh)).limit(1) : [];
  if (taken) throw new HttpError(409, `${taken.email} already belongs to another workspace.`);
  if (fresh.length) await db.insert(s.users).values(fresh.map((email) => ({ tenantId, email, name: email.split("@")[0]!.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), role: "analyst" as const, invitedAt: new Date() })));
  if (clerkEnabled && fresh.length) {
    const [t] = await db.select({ org: s.tenants.clerkOrgId }).from(s.tenants).where(eq(s.tenants.id, tenantId));
    if (t?.org) {
      const { clerkClient } = await import("@clerk/nextjs/server");
      const clerk = await clerkClient();
      for (const email of fresh) await clerk.organizations.createOrganizationInvitation({ organizationId: t.org, emailAddress: email, role: "org:member" });
    }
  }
  await db.insert(s.auditLogs).values(fresh.map((e) => ({ tenantId, userId: actor.id, actorName: actor.name, actorType: "user" as const, action: `invited ${e} to the trial` })));
  return { invited: fresh, remaining: MAX_TEAMMATES - teammates - fresh.length };
}
