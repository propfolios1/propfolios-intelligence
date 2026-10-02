import { eq, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DDTab } from "@/components/composites/mandate/dd-tab";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { hashToken } from "@/lib/actions";
import type { DDFinding } from "@/lib/ai/schemas";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Due Diligence Findings", robots: { index: false, follow: false } };

/**
 * Read-only due diligence report for a named recipient (for example a lender),
 * opened from an expiring link created by an approved action. Revoked or
 * expired links show nothing.
 */
export default async function SharedReport({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) notFound();
  const db = await getDb();
  const [link] = await db.select().from(s.shareLinks).where(eq(s.shareLinks.tokenHash, hashToken(token))).limit(1);
  if (!link || link.revokedAt || link.expiresAt < new Date()) notFound();
  const [row] = await db
    .select({ m: s.mandates, p: s.properties, t: s.tenants })
    .from(s.mandates)
    .innerJoin(s.properties, eq(s.properties.id, s.mandates.propertyId))
    .innerJoin(s.tenants, eq(s.tenants.id, s.mandates.tenantId))
    .where(eq(s.mandates.id, link.mandateId))
    .limit(1);
  if (!row || row.m.tenantId !== link.tenantId) notFound();
  await db.update(s.shareLinks).set({ views: sql`${s.shareLinks.views} + 1` }).where(eq(s.shareLinks.id, link.id));
  const findings = (row.m.ddFindings ?? []) as DDFinding[];
  const brand = row.t.configJson.brand_name;
  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-ink-200 bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <span className="font-display text-card text-navy-900">{brand}</span>
          <span className="text-small text-ink-500">Confidential · prepared for {link.recipient}</span>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-12">
        <div className="eyebrow">Due Diligence Findings · {row.m.reference}</div>
        <h1 className="mt-3 font-display text-title text-navy-900">{row.p.name}</h1>
        <p className="mt-3 text-body text-ink-700">
          {row.p.community}, {row.p.city}. Developer registration {row.p.reraNumber}. Findings as at {formatDate(row.m.updatedAt)}.
        </p>
        <div className="mt-10">{findings.length ? <DDTab findings={findings} /> : <p className="text-small text-ink-500">No findings are recorded for this mandate.</p>}</div>
        <p className="mt-12 border-t border-ink-200 pt-6 text-small text-ink-500">
          Shared by {brand} for {link.recipient}. This link expires on {formatDate(link.expiresAt)} and may be withdrawn at any time. Findings are prepared for the recipient&apos;s credit assessment and do not constitute investment advice.
        </p>
      </div>
    </main>
  );
}
