import "server-only";
import { and, asc, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { PortalFieldRule } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { IntegrationError } from "@/lib/integrations/http";
import { openJson, seal } from "@/lib/integrations/vault";
import { scope } from "@/lib/tenant-db";
import { buildPayload, type ListingContext } from "./payload";
import { PORTAL_SPECS, type FieldRule } from "./specs";
import { type Conn, fetchStatus, send, type Secrets, testConnection } from "./transport";

/**
 * Portal publishing. One click on a listing queues a job per portal and runs
 * it at once; Supabase Cron (portal-publish-poll, every 15 minutes) retries
 * failures with backoff, honours each portal's rate limit and Retry-After,
 * and polls live status so rejections reach the listing page.
 */

export const MAX_ATTEMPTS = 5;
type Actor = { id: string | null; name: string };

export const specOf = (portal: string) => {
  const spec = PORTAL_SPECS[portal];
  if (!spec) throw new HttpError(404, `No portal named ${portal}.`);
  return spec;
};

export async function connectionFor(db: DB, tenantId: string, portal: string, opts: { fetcher?: typeof fetch } = {}): Promise<{ row: typeof s.portalConnections.$inferSelect; conn: Conn; rules: FieldRule[] }> {
  const [row] = await db.select().from(s.portalConnections).where(scope(s.portalConnections, tenantId, eq(s.portalConnections.portal, portal)));
  if (!row || row.status === "disabled") throw new HttpError(409, `${specOf(portal).name} is not connected. Connect it in Administration > Portals.`);
  const spec = specOf(portal);
  return { row, conn: { spec, config: row.config, secrets: openJson<Secrets>(row.credentialsEncrypted) ?? {}, fetcher: opts.fetcher }, rules: (row.fieldMap as FieldRule[] | null) ?? spec.fieldMap };
}

export async function connectPortal(db: DB, tenantId: string, portal: string, input: { config: Record<string, string>; secrets: Secrets; test?: boolean }, actor: Actor, opts: { fetcher?: typeof fetch } = {}) {
  const spec = specOf(portal);
  const [existing] = await db.select().from(s.portalConnections).where(scope(s.portalConnections, tenantId, eq(s.portalConnections.portal, portal)));
  // Blank secret fields keep the stored value, so a firm can change one setting without re-entering every key.
  const secrets = { ...(openJson<Secrets>(existing?.credentialsEncrypted) ?? {}), ...Object.fromEntries(Object.entries(input.secrets).filter(([, v]) => v)) } as Secrets;
  const config = { ...(existing?.config ?? {}), ...Object.fromEntries(Object.entries(input.config).filter(([, v]) => v !== undefined)) };
  if (input.test !== false) {
    try {
      await testConnection({ spec, config, secrets, fetcher: opts.fetcher });
    } catch (e) {
      throw new HttpError(422, e instanceof Error ? e.message : `${spec.name} did not accept the connection.`);
    }
  }
  const values = { config, credentialsEncrypted: seal(secrets as Record<string, unknown>), status: "connected" as const, lastError: null, lastSyncAt: new Date() };
  const [row] = existing
    ? await db.update(s.portalConnections).set(values).where(eq(s.portalConnections.id, existing.id)).returning()
    : await db.insert(s.portalConnections).values({ tenantId, portal, createdBy: actor.id, ...values }).returning();
  return row!;
}

export async function saveFieldMap(db: DB, tenantId: string, portal: string, rules: PortalFieldRule[] | null) {
  const { row } = await connectionFor(db, tenantId, portal);
  await db.update(s.portalConnections).set({ fieldMap: rules }).where(eq(s.portalConnections.id, row.id));
}

export async function listingContext(db: DB, tenantId: string, listingId: string, config: Record<string, string>): Promise<ListingContext> {
  const [r] = await db.select({ l: s.listings, agent: s.users }).from(s.listings).leftJoin(s.users, eq(s.users.id, s.listings.agentUserId)).where(scope(s.listings, tenantId, eq(s.listings.id, listingId)));
  if (!r) throw new HttpError(404, "Listing not found.");
  const l = r.l;
  return { reference: l.reference, title: l.title, description: l.description, purpose: l.purpose, propertyType: l.propertyType, price: l.price, currency: l.currency, city: l.city, community: l.community, bedrooms: l.bedrooms, bathrooms: l.bathrooms, area: l.area, areaUnit: l.areaUnit, permitNumber: l.permitNumber, photos: l.photos, agentName: r.agent?.name ?? null, agentEmail: r.agent?.email ?? null, agentPhone: null, rentPeriod: l.rentPeriod, status: l.status, listedAt: l.listedAt, features: l.features, branchId: config.branchId ?? null, networkId: config.networkId ?? null };
}

/** One-click publish, update or removal on one or more portals. Validates first; runs at once unless `defer`. */
export async function requestPublish(db: DB, tenantId: string, listingId: string, portals: string[], action: "publish" | "update" | "unpublish", actor: Actor, opts: { defer?: boolean; fetcher?: typeof fetch } = {}) {
  const results: { portal: string; status: string; error: string | null; jobId: string }[] = [];
  for (const portal of portals) {
    const { conn, rules } = await connectionFor(db, tenantId, portal, opts);
    if (action !== "unpublish") {
      const built = buildPayload(rules, await listingContext(db, tenantId, listingId, conn.config));
      if (!built.ok) throw new HttpError(422, `${conn.spec.name} requires ${built.missing.map((m) => m.split(".").pop()).join(", ")}. Complete the listing or adjust the field map.`);
    }
    const [pl] = await db
      .insert(s.portalListings)
      .values({ tenantId, listingId, portal, status: "queued" })
      .onConflictDoUpdate({ target: [s.portalListings.listingId, s.portalListings.portal], set: { status: action === "unpublish" ? sql`${s.portalListings.status}` : "queued", lastError: null, updatedAt: new Date() } })
      .returning();
    const effective = action === "publish" && pl!.externalId && pl!.status !== "removed" ? "update" : action;
    const [job] = await db.insert(s.portalPublishJobs).values({ tenantId, portalListingId: pl!.id, action: effective, requestedBy: actor.name }).returning();
    if (!opts.defer) await processJob(db, job!.id, opts);
    const [after] = await db.select().from(s.portalListings).where(eq(s.portalListings.id, pl!.id));
    results.push({ portal, status: after!.status, error: after!.lastError, jobId: job!.id });
  }
  return results;
}

function backoffMs(attempts: number) {
  return Math.min(60, 2 ** attempts) * 60_000;
}

/** Runs one job: rate limit, send, record. Failures are retried up to MAX_ATTEMPTS. */
export async function processJob(db: DB, jobId: string, opts: { fetcher?: typeof fetch; now?: number } = {}) {
  const now = opts.now ?? Date.now();
  const [job] = await db.select().from(s.portalPublishJobs).where(eq(s.portalPublishJobs.id, jobId));
  if (!job || job.status === "succeeded" || job.status === "running") return job;
  const [pl] = await db.select().from(s.portalListings).where(eq(s.portalListings.id, job.portalListingId));
  if (!pl) return job;
  let ctx: Awaited<ReturnType<typeof connectionFor>>;
  try {
    ctx = await connectionFor(db, job.tenantId, pl.portal, opts);
  } catch (e) {
    await db.update(s.portalPublishJobs).set({ status: "failed", errors: [...job.errors, { at: new Date(now).toISOString(), message: (e as Error).message }], finishedAt: new Date(now) }).where(eq(s.portalPublishJobs.id, job.id));
    return job;
  }
  // Per-connection rate limit over the last minute.
  const [recent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.portalPublishJobs)
    .innerJoin(s.portalListings, eq(s.portalListings.id, s.portalPublishJobs.portalListingId))
    .where(and(eq(s.portalPublishJobs.tenantId, job.tenantId), eq(s.portalListings.portal, pl.portal), gte(s.portalPublishJobs.updatedAt, new Date(now - 60_000)), inArray(s.portalPublishJobs.status, ["succeeded", "failed", "running"])));
  if ((recent?.n ?? 0) >= ctx.conn.spec.rateLimitPerMinute) {
    const [deferred] = await db.update(s.portalPublishJobs).set({ nextAttemptAt: new Date(now + 60_000) }).where(eq(s.portalPublishJobs.id, job.id)).returning();
    return deferred;
  }
  await db.update(s.portalPublishJobs).set({ status: "running", attempts: job.attempts + 1 }).where(eq(s.portalPublishJobs.id, job.id));
  if (job.action !== "unpublish") await db.update(s.portalListings).set({ status: "publishing" }).where(eq(s.portalListings.id, pl.id));
  try {
    const listing = await listingContext(db, job.tenantId, pl.listingId, ctx.conn.config);
    const built = buildPayload(ctx.rules, listing);
    if (!built.ok) throw new IntegrationError(ctx.conn.spec.name, 422, `requires ${built.missing.join(", ")}`);
    const r = await send(ctx.conn, job.action, built.payload, pl.externalId);
    await db
      .update(s.portalListings)
      .set({ status: r.status, externalId: r.externalId ?? pl.externalId, externalUrl: r.externalUrl ?? pl.externalUrl, lastError: null, payloadHash: built.hash, publishedAt: job.action === "publish" ? new Date(now) : pl.publishedAt, lastPolledAt: new Date(now) })
      .where(eq(s.portalListings.id, pl.id));
    await db.update(s.portalPublishJobs).set({ status: "succeeded", finishedAt: new Date(now) }).where(eq(s.portalPublishJobs.id, job.id));
    await db.update(s.portalConnections).set({ lastSyncAt: new Date(now), lastError: null, status: "connected" }).where(eq(s.portalConnections.id, ctx.row.id));
    // The feed-based syndication record follows the API state, so listing pages show one truth.
    await db
      .insert(s.listingSyndications)
      .values({ tenantId: job.tenantId, listingId: pl.listingId, portal: pl.portal, status: r.status === "removed" ? "paused" : r.status === "live" ? "live" : "queued", externalRef: r.externalId ?? pl.externalId, lastSyncedAt: new Date(now) })
      .onConflictDoUpdate({ target: [s.listingSyndications.listingId, s.listingSyndications.portal], set: { status: r.status === "removed" ? "paused" : r.status === "live" ? "live" : "queued", externalRef: r.externalId ?? pl.externalId, lastSyncedAt: new Date(now), issue: null } });
  } catch (e) {
    const err = e instanceof IntegrationError ? e : null;
    const message = e instanceof Error ? e.message : String(e);
    const attempts = job.attempts + 1;
    const permanent = err && [400, 401, 403, 404, 422].includes(err.status);
    const retryAfter = err?.status === 429 ? 60_000 : backoffMs(attempts);
    const failed = permanent || attempts >= MAX_ATTEMPTS;
    await db
      .update(s.portalPublishJobs)
      .set({ status: failed ? "failed" : "queued", nextAttemptAt: new Date(now + retryAfter), errors: [...job.errors, { at: new Date(now).toISOString(), message: message.slice(0, 500), status: err?.status }], finishedAt: failed ? new Date(now) : null })
      .where(eq(s.portalPublishJobs.id, job.id));
    await db.update(s.portalListings).set({ status: failed ? (err?.status === 422 ? "rejected" : "error") : "queued", lastError: message.slice(0, 500) }).where(eq(s.portalListings.id, pl.id));
    await db.update(s.portalConnections).set({ lastError: message.slice(0, 500), status: err && [401, 403].includes(err.status) ? "error" : ctx.row.status }).where(eq(s.portalConnections.id, ctx.row.id));
  }
  const [after] = await db.select().from(s.portalPublishJobs).where(eq(s.portalPublishJobs.id, job.id));
  return after;
}

export async function retryJob(db: DB, tenantId: string, jobId: string, opts: { fetcher?: typeof fetch } = {}) {
  const [job] = await db.select().from(s.portalPublishJobs).where(scope(s.portalPublishJobs, tenantId, eq(s.portalPublishJobs.id, jobId)));
  if (!job) throw new HttpError(404, "Job not found.");
  if (job.status !== "failed") throw new HttpError(409, "Only a failed job can be retried.");
  await db.update(s.portalPublishJobs).set({ status: "queued", attempts: 0, nextAttemptAt: new Date() }).where(eq(s.portalPublishJobs.id, job.id));
  return processJob(db, job.id, opts);
}

/** The scheduled pass: due jobs first, then status polling of recently published listings. */
export async function pollPortals(db: DB, opts: { now?: number; fetcher?: typeof fetch } = {}) {
  const now = opts.now ?? Date.now();
  const due = await db.select({ id: s.portalPublishJobs.id }).from(s.portalPublishJobs).where(and(eq(s.portalPublishJobs.status, "queued"), lte(s.portalPublishJobs.nextAttemptAt, new Date(now)))).orderBy(asc(s.portalPublishJobs.nextAttemptAt)).limit(200);
  let sent = 0;
  for (const d of due) {
    const j = await processJob(db, d.id, opts);
    if (j?.status === "succeeded") sent++;
  }
  const stale = await db
    .select()
    .from(s.portalListings)
    .where(and(inArray(s.portalListings.status, ["publishing", "live"]), or(sql`${s.portalListings.lastPolledAt} is null`, lte(s.portalListings.lastPolledAt, new Date(now - (6 * 3_600_000))), and(eq(s.portalListings.status, "publishing"), lte(s.portalListings.lastPolledAt, new Date(now - 10 * 60_000))))))
    .limit(300);
  let polled = 0;
  let changed = 0;
  for (const pl of stale) {
    try {
      const { conn } = await connectionFor(db, pl.tenantId, pl.portal, opts);
      const [l] = await db.select({ reference: s.listings.reference }).from(s.listings).where(eq(s.listings.id, pl.listingId));
      const st = await fetchStatus(conn, pl.externalId ?? "", l?.reference ?? "");
      polled++;
      const next = st.status ?? pl.status;
      if (next !== pl.status) changed++;
      await db.update(s.portalListings).set({ status: next, lastError: st.issue ?? (next === "rejected" ? pl.lastError : null), lastPolledAt: new Date(now) }).where(eq(s.portalListings.id, pl.id));
    } catch (e) {
      await db.update(s.portalListings).set({ lastPolledAt: new Date(now), lastError: (e as Error).message.slice(0, 500) }).where(eq(s.portalListings.id, pl.id));
    }
  }
  return { due: due.length, sent, polled, changed };
}

export async function portalOverview(db: DB, tenantId: string) {
  const [conns, counts, jobs] = await Promise.all([
    db.select().from(s.portalConnections).where(scope(s.portalConnections, tenantId)),
    db.select({ portal: s.portalListings.portal, status: s.portalListings.status, n: sql<number>`count(*)::int` }).from(s.portalListings).where(scope(s.portalListings, tenantId)).groupBy(s.portalListings.portal, s.portalListings.status),
    db.select({ j: s.portalPublishJobs, portal: s.portalListings.portal, listingId: s.portalListings.listingId, reference: s.listings.reference, title: s.listings.title }).from(s.portalPublishJobs).innerJoin(s.portalListings, eq(s.portalListings.id, s.portalPublishJobs.portalListingId)).innerJoin(s.listings, eq(s.listings.id, s.portalListings.listingId)).where(scope(s.portalPublishJobs, tenantId)).orderBy(desc(s.portalPublishJobs.createdAt)).limit(200),
  ]);
  return { conns, counts, jobs };
}
