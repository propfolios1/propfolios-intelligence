import { and, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";

const DAY = 86_400_000;

/**
 * Three automations per tenant, created before the deals are seeded so the
 * deal history fires them through the event bus exactly as live deals do.
 * Skipped when the tenant already has automations.
 */
export async function seedAutomations(db: DB, t: { tenantId: string; staff: boolean }) {
  const [exists] = await db.select({ id: s.automations.id }).from(s.automations).where(eq(s.automations.tenantId, t.tenantId)).limit(1);
  if (exists) return { automations: 0 };
  const [admin] = await db.select({ email: s.users.email, name: s.users.name }).from(s.users).where(and(eq(s.users.tenantId, t.tenantId), eq(s.users.role, "tenant_admin"))).limit(1);
  const by = admin?.name ?? "Firm administrator";
  const createdAt = new Date(Date.now() - 120 * DAY);
  await db.insert(s.automations).values([
    {
      tenantId: t.tenantId,
      name: "Closings above AED 3M to the managing partner",
      trigger: "deal.closed",
      conditions: [{ field: "deal_value_aed", op: "gt", value: 3_000_000 }],
      actions: [
        { type: "notify_team", subject: "Closing above AED 3M", message: "A deal above AED 3 million has closed. Confirm the commission split and schedule the client debrief within the week." },
        ...(admin ? [{ type: "send_email" as const, to: admin.email, subject: "Closing above AED 3M", message: "A deal above AED 3 million has closed. The commission has been computed and invoiced automatically; review the split before month end." }] : []),
      ],
      createdBy: by,
      createdAt,
    },
    {
      tenantId: t.tenantId,
      name: "Mumbai agreements: open the registration file",
      trigger: "deal.stage_changed",
      conditions: [
        { field: "jurisdiction", op: "eq", value: "mumbai" },
        { field: "stage", op: "eq", value: "contract" },
      ],
      actions: [
        { type: "create_task", subject: "Book the sub-registrar slot and pay stamp duty", message: "Agreement for sale is in contract. Pay 6% stamp duty (5% plus 1% metro cess) and 1% registration (capped at INR 30,000) through GRAS, book the sub-registrar appointment and confirm TDS under s.194-IA (s.195 for NRI sellers).", dueInDays: 5 },
        { type: "notify_team", subject: "Mumbai deal in contract", message: "A Mumbai deal has reached contract. The registration task has been created." },
      ],
      createdBy: by,
      createdAt,
    },
    {
      tenantId: t.tenantId,
      name: "KYC lapsed: hold and request documents",
      trigger: "kyc.expired",
      conditions: [],
      actions: [
        { type: "notify_team", subject: "KYC lapsed", message: "A client's KYC has lapsed. No new transaction may proceed until updated identification and proof of address are verified." },
        { type: "create_task", subject: "Request updated KYC documents", message: "Request a current passport, Emirates ID or PAN, and proof of address dated within three months, through the client portal.", dueInDays: 2 },
      ],
      createdBy: by,
      createdAt,
    },
  ]);
  return { automations: 3 };
}

const purposesFor = (residency: string, federation: boolean) =>
  [
    { purpose: "data_processing" as const, granted: true },
    { purpose: "cross_border_transfer" as const, granted: /NRI|India/i.test(residency) },
    { purpose: "federation" as const, granted: federation },
    { purpose: "marketing" as const, granted: !/NRI/i.test(residency) },
  ];

/**
 * Consents for every client, two data subject requests, delivery
 * preferences and a mention, so compliance and notifications open on a
 * realistic state. Skipped when consents already exist.
 */
export async function seedFabricRecords(db: DB, t: { tenantId: string; slug: string; staff: boolean; id: (k: string) => string }) {
  const [exists] = await db.select({ id: s.consents.id }).from(s.consents).where(eq(s.consents.tenantId, t.tenantId)).limit(1);
  if (exists) return { consents: 0 };
  const [tenant] = await db.select({ federation: s.tenants.consentFederation }).from(s.tenants).where(eq(s.tenants.id, t.tenantId));
  const clients = await db.select().from(s.clients).where(eq(s.clients.tenantId, t.tenantId));
  const rows = clients.flatMap((c, i) => {
    const signed = new Date(c.createdAt.getTime() + DAY);
    const india = /India|NRI/i.test(`${c.residency} ${c.domicile}`);
    return purposesFor(c.residency, tenant?.federation ?? false).map((p) => ({
      tenantId: t.tenantId,
      clientId: c.id,
      purpose: p.purpose,
      granted: p.granted,
      version: "2026-04",
      jurisdiction: (india ? "India" : "UAE") as "India" | "UAE",
      grantedAt: p.granted ? signed : null,
      withdrawnAt: p.granted ? null : new Date(signed.getTime() + (20 + i) * DAY),
      source: p.granted ? "Client onboarding form, signed electronically" : "Withdrawn by the client in writing",
      createdAt: signed,
    }));
  });
  if (rows.length) await db.insert(s.consents).values(rows).onConflictDoNothing();

  const byName = (n: string) => clients.find((c) => c.name.startsWith(n));
  const fatima = byName("Fatima");
  const rajesh = byName("Rajesh");
  const steps = (names: string[], done: number, start: Date) => names.map((step, i) => ({ step, done: i < done, at: i < done ? new Date(start.getTime() + (i + 1) * DAY).toISOString() : null }));
  const [portal] = fatima ? await db.select({ email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, t.tenantId), eq(s.users.clientId, fatima.id))).limit(1) : [];
  const recv1 = new Date(Date.now() - 9 * DAY);
  const recv2 = new Date(Date.now() - 41 * DAY);
  await db.insert(s.dataRequests).values([
    ...(fatima ? [{ tenantId: t.tenantId, clientId: fatima.id, subjectEmail: portal?.email ?? "fatima.alsuwaidi@icloud.com", type: "access" as const, regime: "UAE PDPL" as const, status: "in_progress" as const, dueAt: new Date(recv1.getTime() + 30 * DAY), steps: steps(["Verify the requester's identity", "Compile the data held", "Review for third-party data", "Send the export to the data subject"], 2, recv1), createdBy: "Layla Haddad", createdAt: recv1 }] : []),
    ...(rajesh ? [{ tenantId: t.tenantId, clientId: rajesh.id, subjectEmail: "rajesh@mehtacapital.in", type: "rectification" as const, regime: "DPDP" as const, status: "completed" as const, dueAt: new Date(recv2.getTime() + 30 * DAY), completedAt: new Date(recv2.getTime() + 4 * DAY), steps: steps(["Verify the requester's identity", "Correct the records", "Confirm the correction to the data subject"], 3, recv2), createdBy: "Layla Haddad", createdAt: recv2 }] : []),
  ]);

  const staff = await db.select({ id: s.users.id, name: s.users.name, email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, t.tenantId), inArray(s.users.role, ["tenant_admin", "analyst"])));
  const aisha = staff.find((u) => u.email.startsWith("aisha"));
  if (aisha) {
    await db
      .insert(s.notificationPreferences)
      .values([
        { tenantId: t.tenantId, userId: aisha.id, category: "deals", inApp: true, email: true, digest: "daily" },
        { tenantId: t.tenantId, userId: aisha.id, category: "mentions", inApp: true, email: true, digest: "off" },
        { tenantId: t.tenantId, userId: aisha.id, category: "insights", inApp: true, email: false, digest: "off" },
      ])
      .onConflictDoNothing();
    const [d3] = await db.select({ id: s.deals.id }).from(s.deals).where(and(eq(s.deals.tenantId, t.tenantId), eq(s.deals.reference, "DL-0003"))).limit(1);
    if (d3)
      await db.insert(s.notifications).values({
        tenantId: t.tenantId,
        userId: aisha.id,
        category: "mentions",
        priority: "high",
        title: `${t.staff ? "Rohan Mehta" : "A colleague"} mentioned you`,
        body: "DL-0003 negotiation note: @Aisha the developer will hold the villa until Friday. Can you confirm the rental guarantee terms with the client before we counter?",
        href: `/analyst/deals/${d3.id}?tab=negotiations`,
        createdAt: new Date(Date.now() - 2 * DAY),
      });
  }
  return { consents: rows.length, dataRequests: (fatima ? 1 : 0) + (rajesh ? 1 : 0) };
}
