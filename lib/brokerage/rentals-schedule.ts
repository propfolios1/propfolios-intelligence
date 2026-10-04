const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Rent schedule for a tenancy: equal instalments from the start date (cheques in the UAE, monthly debits elsewhere). */
export function rentSchedule(t: { startDate: string; rent: number; frequency: "monthly" | "quarterly" | "annual"; instalments: number }) {
  const annual = t.frequency === "monthly" ? t.rent * 12 : t.frequency === "quarterly" ? t.rent * 4 : t.rent;
  const n = Math.max(1, t.instalments);
  const months = 12 / n;
  const start = new Date(`${t.startDate}T00:00:00Z`);
  const each = Math.round((annual / n) * 100) / 100;
  return Array.from({ length: n }, (_, k) => {
    const d = new Date(start);
    d.setUTCMonth(d.getUTCMonth() + Math.round(k * months));
    // The last instalment absorbs rounding so the schedule sums to the annual rent exactly.
    return { dueDate: iso(d), amount: k === n - 1 ? Math.round((annual - each * (n - 1)) * 100) / 100 : each };
  });
}
