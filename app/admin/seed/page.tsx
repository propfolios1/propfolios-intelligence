import { count } from "drizzle-orm";
import { PageHeader } from "@/components/composites/page-header";
import { SeedButton } from "@/components/composites/seed-button";
import { StatCard } from "@/components/composites/stat-card";
import { PageContainer } from "@/components/shell/page-container";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { dbKind, getDb } from "@/db";
import * as s from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { scope } from "@/lib/tenant-db";

export const metadata = { title: "Seed data" };
export const dynamic = "force-dynamic";

export default async function SeedPage() {
  const user = await requireRole(["tenant_admin"]);
  const db = await getDb();
  const tables = [
    ["Clients", s.clients],
    ["Holdings", s.portfolios],
    ["Mandates", s.mandates],
    ["Memos", s.memos],
    ["Properties", s.properties],
    ["Developers", s.developers],
    ["Transactions", s.transactions],
    ["Market months", s.marketData],
    ["Documents", s.documents],
    ["Recommendations", s.recommendations],
    ["Alerts", s.alerts],
    ["Audit events", s.auditLogs],
  ] as const;
  const counts = await Promise.all(tables.map(async ([label, t]) => [label, Number((await db.select({ n: count() }).from(t).where(scope(t, user.tenantId)))[0]!.n)] as const));
  const kind = dbKind();
  return (
    <PageContainer>
      <PageHeader eyebrow="Administration" title="Seed data" subtitle="Your workspace's demonstration dataset: five clients, thirty named UAE and India projects, eighteen developers, twelve months of market data and three mandates at different stages. Resetting affects this workspace only." actions={<SeedButton />} />
      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {counts.map(([label, n]) => (
          <StatCard key={label} label={label} value={n.toLocaleString("en-US")} />
        ))}
      </section>
      <Card className="mt-8">
        <CardHeader eyebrow="Database" title={kind === "supabase" ? "Supabase Postgres" : kind === "postgres" ? "Postgres" : "Embedded Postgres (PGlite)"} />
        <CardContent className="max-w-[72ch] text-small text-ink-700">
          {kind !== "embedded"
            ? "Connected through DATABASE_URL (or the POSTGRES_URL set by the Vercel Supabase integration). Migrations and the seed run from /api/setup with your SETUP_SECRET; the seed is idempotent and safe to run more than once."
            : "No DATABASE_URL is configured, so this deployment uses an in-memory Postgres that migrates and seeds itself on start. Data resets when the server instance restarts. Connect Supabase in Vercel for persistence."}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
