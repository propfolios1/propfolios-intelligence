import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { marketOf } from "@/lib/markets";
import { scope } from "@/lib/tenant-db";
import { rentSchedule } from "./rentals-schedule";

export { rentSchedule };

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function listTenancies(db: DB, tenantId: string) {
  const ts = await db.select().from(s.tenancies).where(scope(s.tenancies, tenantId)).orderBy(asc(s.tenancies.endDate));
  const ids = ts.map((t) => t.id);
  const [payments, maint] = ids.length
    ? await Promise.all([
        db.select().from(s.rentPayments).where(scope(s.rentPayments, tenantId, inArray(s.rentPayments.tenancyId, ids))).orderBy(asc(s.rentPayments.dueDate)),
        db.select().from(s.maintenanceRequests).where(scope(s.maintenanceRequests, tenantId, inArray(s.maintenanceRequests.tenancyId, ids))).orderBy(desc(s.maintenanceRequests.reportedAt)),
      ])
    : [[], []];
  const today = iso(new Date());
  return ts.map((t) => {
    const p = payments.filter((x) => x.tenancyId === t.id);
    const arrears = p.filter((x) => x.status !== "paid" && x.dueDate < today).reduce((a, x) => a + x.amount, 0);
    const collected = p.filter((x) => x.status === "paid").reduce((a, x) => a + x.amount, 0);
    const daysToEnd = Math.round((new Date(`${t.endDate}T00:00:00Z`).getTime() - Date.now()) / 86_400_000);
    return { tenancy: t, payments: p, maintenance: maint.filter((m) => m.tenancyId === t.id), arrears, collected, daysToEnd, next: p.find((x) => x.status !== "paid") ?? null };
  });
}

export interface NewTenancy {
  unit: string;
  market: string;
  listingId?: string | null;
  landlordClientId?: string | null;
  landlordName: string;
  occupantName: string;
  occupantEmail?: string | null;
  startDate: string;
  endDate: string;
  rent: number;
  frequency: "monthly" | "quarterly" | "annual";
  instalments: number;
  deposit: number;
  registrationNumber?: string | null;
  managementFeePct?: number;
}

export async function createTenancy(db: DB, tenantId: string, n: NewTenancy) {
  if (n.endDate <= n.startDate) throw new HttpError(422, "The tenancy must end after it starts.");
  const m = marketOf(n.market);
  const count = (await db.select({ id: s.tenancies.id }).from(s.tenancies).where(scope(s.tenancies, tenantId))).length;
  const [t] = await db
    .insert(s.tenancies)
    .values({ tenantId, reference: `TN-${String(count + 1).padStart(4, "0")}`, unit: n.unit, market: m.code, listingId: n.listingId ?? null, landlordClientId: n.landlordClientId ?? null, landlordName: n.landlordName, occupantName: n.occupantName, occupantEmail: n.occupantEmail ?? null, startDate: n.startDate, endDate: n.endDate, rent: n.rent, currency: m.currency, frequency: n.frequency, instalments: n.instalments, deposit: n.deposit, registrationNumber: n.registrationNumber ?? null, managementFeePct: n.managementFeePct ?? 5 })
    .returning();
  const schedule = rentSchedule({ startDate: n.startDate, rent: n.rent, frequency: n.frequency, instalments: n.instalments });
  await db.insert(s.rentPayments).values(schedule.map((p) => ({ tenantId, tenancyId: t!.id, dueDate: p.dueDate, amount: p.amount, currency: m.currency })));
  if (n.listingId) await db.update(s.listings).set({ status: "let" }).where(scope(s.listings, tenantId, eq(s.listings.id, n.listingId)));
  return t!;
}

export async function recordRent(db: DB, tenantId: string, paymentId: string, status: "paid" | "late" | "returned", method?: string) {
  const [p] = await db
    .update(s.rentPayments)
    .set({ status, paidOn: status === "paid" ? iso(new Date()) : null, method: method ?? null })
    .where(scope(s.rentPayments, tenantId, eq(s.rentPayments.id, paymentId)))
    .returning();
  if (!p) throw new HttpError(404, "Payment not found.");
  return p;
}

export async function addMaintenance(db: DB, tenantId: string, tenancyId: string, m: { title: string; category: string; priority: "urgent" | "high" | "normal" | "low"; vendor?: string | null }) {
  const [t] = await db.select({ id: s.tenancies.id }).from(s.tenancies).where(scope(s.tenancies, tenantId, eq(s.tenancies.id, tenancyId)));
  if (!t) throw new HttpError(404, "Tenancy not found.");
  const [r] = await db.insert(s.maintenanceRequests).values({ tenantId, tenancyId, title: m.title, category: m.category, priority: m.priority, vendor: m.vendor ?? null }).returning();
  return r!;
}

export async function updateMaintenance(db: DB, tenantId: string, id: string, status: "open" | "scheduled" | "in_progress" | "resolved", cost?: number | null) {
  const [r] = await db
    .update(s.maintenanceRequests)
    .set({ status, ...(cost !== undefined ? { cost } : {}), resolvedAt: status === "resolved" ? new Date() : null })
    .where(scope(s.maintenanceRequests, tenantId, eq(s.maintenanceRequests.id, id)))
    .returning();
  if (!r) throw new HttpError(404, "Request not found.");
  return r;
}
