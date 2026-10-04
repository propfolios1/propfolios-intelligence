import { asc, eq } from "drizzle-orm";
import { AddMaintenance, CreateTenancy, MaintenanceStatus, RentAction } from "@/components/brokerage/actions";
import { marketOptions } from "@/components/brokerage/market-options";
import { PageHeader } from "@/components/composites/page-header";
import { StatCard } from "@/components/composites/stat-card";
import { Flag } from "@/components/os/badges";
import { Section, SimpleTable } from "@/components/os/simple-table";
import { PageContainer } from "@/components/shell/page-container";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { listTenancies } from "@/lib/brokerage/rentals";
import { formatLocal } from "@/lib/format";
import { scope } from "@/lib/tenant-db";
import { cn, formatDate } from "@/lib/utils";

export const metadata = { title: "Rentals" };
export const dynamic = "force-dynamic";

const PRIORITY = { urgent: "error", high: "error", normal: "neutral", low: "neutral" } as const;
const FREQ: Record<string, string> = { annual: "a year", quarterly: "a quarter", monthly: "a month" };

export default async function RentalsPage() {
  const user = await requireRole(["tenant_admin", "analyst"]);
  const db = await getDb();
  const [rows, landlords, listings] = await Promise.all([
    listTenancies(db, user.tenantId),
    db.select({ id: s.clients.id, name: s.clients.name }).from(s.clients).where(scope(s.clients, user.tenantId)).orderBy(asc(s.clients.name)),
    db.select({ id: s.listings.id, name: s.listings.title, market: s.listings.market }).from(s.listings).where(scope(s.listings, user.tenantId, eq(s.listings.purpose, "rent"))).orderBy(asc(s.listings.title)),
  ]);
  const active = rows.filter((r) => r.tenancy.status === "active");
  const cur = active[0]?.tenancy.currency ?? "AED";
  const annual = (r: (typeof rows)[number]) => (r.tenancy.frequency === "monthly" ? r.tenancy.rent * 12 : r.tenancy.frequency === "quarterly" ? r.tenancy.rent * 4 : r.tenancy.rent);
  const rentRoll = active.reduce((a, r) => a + annual(r), 0);
  const fees = active.reduce((a, r) => a + (annual(r) * r.tenancy.managementFeePct) / 100, 0);
  const arrears = rows.reduce((a, r) => a + r.arrears, 0);
  const renewals = active.filter((r) => r.daysToEnd <= 90);
  const today = new Date().toISOString().slice(0, 10);
  const due = rows.flatMap((r) => r.payments.filter((p) => p.status !== "paid" && p.dueDate <= new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10)).map((p) => ({ p, t: r.tenancy })));
  const maint = rows.flatMap((r) => r.maintenance.map((m) => ({ m, t: r.tenancy })));
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Brokerage"
        title="Rentals"
        subtitle="Tenancies under management: the rent schedule and arrears, renewals coming up, and maintenance requests. Landlords see their own tenancies in the client portal."
        actions={
          <>
            <AddMaintenance tenancies={rows.map((r) => ({ id: r.tenancy.id, name: `${r.tenancy.reference} · ${r.tenancy.unit}` }))} />
            <CreateTenancy markets={marketOptions()} landlords={landlords} listings={listings} />
          </>
        }
      />
      <section className="my-8 stat-row">
        <StatCard label="Annual rent roll" value={formatLocal(rentRoll, cur)} note={`${active.length} active tenancies`} />
        <StatCard label="Management fees" value={formatLocal(fees, cur)} note="A year, at each tenancy's rate" />
        <StatCard label="Arrears" value={formatLocal(arrears, cur)} note={arrears ? "Past due and not received" : "Nothing past due"} />
        <StatCard label="Renewals in 90 days" value={String(renewals.length)} note={renewals[0] ? `First: ${renewals[0].tenancy.reference}` : "None"} />
      </section>
      <Section title="Tenancies">
        <SimpleTable
          rows={rows}
          minWidth={1100}
          empty="No tenancies yet."
          columns={[
            { key: "r", header: "Tenancy", cell: (r) => <span className="text-ink-900"><span className="num">{r.tenancy.reference}</span> · {r.tenancy.unit}</span> },
            { key: "l", header: "Landlord", cell: (r) => r.tenancy.landlordName },
            { key: "o", header: "Occupant", cell: (r) => r.tenancy.occupantName },
            { key: "rent", header: "Rent", numeric: true, cell: (r) => `${formatLocal(r.tenancy.rent, r.tenancy.currency)} ${FREQ[r.tenancy.frequency]}` },
            { key: "i", header: "Instalments", numeric: true, cell: (r) => r.tenancy.instalments },
            { key: "c", header: "Collected", numeric: true, cell: (r) => formatLocal(r.collected, r.tenancy.currency) },
            { key: "a", header: "Arrears", numeric: true, cell: (r) => <span className={cn(r.arrears > 0 && "text-danger")}>{r.arrears ? formatLocal(r.arrears, r.tenancy.currency) : "None"}</span> },
            { key: "e", header: "Ends", cell: (r) => <span className={cn(r.daysToEnd <= 90 && "text-warning")}>{formatDate(r.tenancy.endDate)}</span> },
            { key: "reg", header: "Registration", cell: (r) => (r.tenancy.registrationNumber ? <span className="num">{r.tenancy.registrationNumber}</span> : "Not registered") },
          ]}
        />
      </Section>
      <Section title="Rent due" description="Instalments past due or due in the next 45 days.">
        <SimpleTable
          rows={due}
          minWidth={820}
          empty="Nothing due."
          columns={[
            { key: "d", header: "Due", cell: ({ p }) => <span className={cn(p.dueDate < today && "text-danger")}>{formatDate(p.dueDate)}</span> },
            { key: "t", header: "Tenancy", cell: ({ t }) => `${t.reference} · ${t.unit}` },
            { key: "o", header: "Occupant", cell: ({ t }) => t.occupantName },
            { key: "a", header: "Amount", numeric: true, cell: ({ p }) => formatLocal(p.amount, p.currency, { compact: false }) },
            { key: "s", header: "Status", cell: ({ p }) => <Flag tone={p.status === "late" || p.status === "returned" || p.dueDate < today ? "error" : "neutral"}>{p.dueDate < today && p.status === "scheduled" ? "overdue" : p.status}</Flag> },
            { key: "x", header: "", cell: ({ p }) => <RentAction id={p.id} /> },
          ]}
        />
      </Section>
      <Section title="Maintenance">
        <SimpleTable
          rows={maint}
          minWidth={900}
          empty="No maintenance requests."
          columns={[
            { key: "t", header: "Request", cell: ({ m }) => <span className="text-ink-900">{m.title}</span> },
            { key: "u", header: "Tenancy", cell: ({ t }) => t.reference },
            { key: "c", header: "Category", cell: ({ m }) => m.category },
            { key: "p", header: "Priority", cell: ({ m }) => <Flag tone={PRIORITY[m.priority]}>{m.priority}</Flag> },
            { key: "v", header: "Vendor", cell: ({ m }) => m.vendor ?? "Not assigned" },
            { key: "cost", header: "Cost", numeric: true, cell: ({ m, t }) => (m.cost ? formatLocal(m.cost, t.currency) : "None") },
            { key: "s", header: "Status", cell: ({ m }) => <MaintenanceStatus id={m.id} status={m.status} /> },
          ]}
        />
      </Section>
    </PageContainer>
  );
}
