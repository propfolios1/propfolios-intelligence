import "server-only";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { MigrationEntity, MigrationSource, MigrationTotals } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { scoreLead } from "@/lib/brokerage/scoring";
import { openJson, seal } from "@/lib/integrations/vault";
import { MARKETS, SOURCE_NAME, type MarketCode } from "@/lib/markets";
import { scope } from "@/lib/tenant-db";
import { csvRecords } from "./csv";
import { autoMap, buildLead, buildListing, type LeadDraft, leadKeys, type ListingDraft, type MappingRule } from "./fields";
import { type Credentials, SOURCES, tokenRequest } from "./sources";

/**
 * The import pipeline. Extract stages source records once; mapping, preview
 * and the dry run read the staged rows without writing; the load step writes
 * in batches so a job of any size advances within serverless time limits, and
 * every created record is tied to its row so the import can be rolled back
 * for 24 hours.
 */

export const LOAD_BATCH = 250;
export const ROLLBACK_HOURS = 24;
export const MAX_ROWS = 50_000;
const ZERO: MigrationTotals = { staged: 0, processed: 0, created: 0, skipped: 0, failed: 0 };

type Job = typeof s.migrationJobs.$inferSelect;
type Actor = { id: string | null; name: string };

export async function getJob(db: DB, tenantId: string, id: string) {
  const [job] = await db.select().from(s.migrationJobs).where(scope(s.migrationJobs, tenantId, eq(s.migrationJobs.id, id)));
  if (!job) throw new HttpError(404, "Import not found.");
  return job;
}

async function log(db: DB, job: Pick<Job, "id" | "tenantId">, phase: (typeof s.migrationLogs.$inferInsert)["phase"], message: string, extra: { level?: "info" | "warning" | "error"; rowNumber?: number; detail?: Record<string, unknown> } = {}) {
  await db.insert(s.migrationLogs).values({ tenantId: job.tenantId, jobId: job.id, phase, message, level: extra.level ?? "info", rowNumber: extra.rowNumber ?? null, detail: extra.detail ?? null });
}

export async function createJob(db: DB, tenantId: string, input: { source: MigrationSource; entity: MigrationEntity; defaultMarket: MarketCode }, actor: Actor) {
  const adapter = SOURCES[input.source];
  if (!adapter.entities.includes(input.entity)) throw new HttpError(422, `${adapter.name} imports ${adapter.entities.join(" and ")} only.`);
  const [r] = await db.select({ n: sql<number>`coalesce(max(substring(${s.migrationJobs.reference} from 4)::int), 0)::int` }).from(s.migrationJobs).where(scope(s.migrationJobs, tenantId));
  const [job] = await db
    .insert(s.migrationJobs)
    .values({ tenantId, reference: `MG-${String((r?.n ?? 0) + 1).padStart(4, "0")}`, source: input.source, entity: input.entity, defaultMarket: input.defaultMarket, status: "connecting", createdBy: actor.id })
    .returning();
  await log(db, job!, "connect", `Import created by ${actor.name}: ${adapter.name}, ${input.entity}.`);
  return job!;
}

/* ---------------------------------------------------------------- extract */

async function stage(db: DB, job: Job, records: { externalId: string | null; data: Record<string, string> }[]) {
  const [m] = await db.select({ n: sql<number>`coalesce(max(${s.migrationRows.rowNumber}), 0)::int` }).from(s.migrationRows).where(eq(s.migrationRows.jobId, job.id));
  const start = m?.n ?? 0;
  if (start + records.length > MAX_ROWS) throw new HttpError(422, `An import holds at most ${MAX_ROWS.toLocaleString("en-US")} records; split the file or filter the export.`);
  for (let i = 0; i < records.length; i += 500)
    await db.insert(s.migrationRows).values(records.slice(i, i + 500).map((r, k) => ({ tenantId: job.tenantId, jobId: job.id, rowNumber: start + i + k + 1, externalId: r.externalId, data: r.data })));
  const fields = new Set(job.sourceFields);
  for (const r of records) for (const k of Object.keys(r.data)) if (fields.size < 400) fields.add(k);
  return { staged: start + records.length, fields: [...fields] };
}

async function finishExtract(db: DB, job: Job, fields: string[], staged: number) {
  const existing = await db.select({ id: s.migrationFieldMaps.id }).from(s.migrationFieldMaps).where(eq(s.migrationFieldMaps.jobId, job.id));
  if (!existing.length) {
    const proposal = autoMap(job.entity, fields);
    if (proposal.length) await db.insert(s.migrationFieldMaps).values(proposal.map((p, i) => ({ tenantId: job.tenantId, jobId: job.id, ...p, position: i })));
    await log(db, job, "map", `Proposed ${proposal.length} field mappings from ${fields.length} source fields.`);
  }
  await db.update(s.migrationJobs).set({ status: "mapping", extracted: true, cursor: null, sourceFields: fields, totals: { ...ZERO, staged } }).where(eq(s.migrationJobs.id, job.id));
}

export async function stageCsv(db: DB, job: Job, text: string, fileName: string) {
  if (job.source !== "csv") throw new HttpError(422, "This import reads from a connected system, not a file.");
  if (job.extracted) throw new HttpError(409, "This import already has its file. Start a new import for another file.");
  const { headers, records } = csvRecords(text);
  if (!headers.length || !records.length) throw new HttpError(422, "The file has no data rows under its header row.");
  const ext = headers.find((h) => /^(id|record id|external id|reference)$/i.test(h));
  const { staged, fields } = await stage(db, { ...job, sourceFields: headers }, records.map((r) => ({ externalId: ext ? r[ext] || null : null, data: r })));
  await db.update(s.migrationJobs).set({ fileName: fileName.slice(0, 200) }).where(eq(s.migrationJobs.id, job.id));
  await log(db, job, "extract", `Read ${records.length.toLocaleString("en-US")} rows and ${headers.length} columns from ${fileName}.`);
  await finishExtract(db, job, fields, staged);
}

/** Stores credentials sealed. For API-key sources the key is tested by reading the first page, which is staged. */
export async function connect(db: DB, job: Job, cred: Credentials, account?: string | null) {
  await db.update(s.migrationJobs).set({ credentials: seal(cred as Record<string, unknown>), account: account ?? null, status: "extracting", error: null }).where(eq(s.migrationJobs.id, job.id));
  await log(db, job, "connect", `Connected to ${SOURCES[job.source].name}${account ? ` (${account})` : ""}.`);
}

async function freshCredentials(db: DB, job: Job): Promise<Credentials> {
  const cred = openJson<Credentials>(job.credentials);
  if (!cred) throw new HttpError(409, "Connect the source system first.");
  const adapter = SOURCES[job.source];
  if (adapter.oauth && cred.refreshToken && (!cred.accessToken || (cred.expiresAt && cred.expiresAt < Date.now() + 60_000))) {
    const next = await tokenRequest(adapter, { grant_type: "refresh_token", refresh_token: cred.refreshToken }, cred);
    await db.update(s.migrationJobs).set({ credentials: seal(next as Record<string, unknown>) }).where(eq(s.migrationJobs.id, job.id));
    return next;
  }
  return cred;
}

/** Reads one page from the source. Call until `done`. */
export async function extractStep(db: DB, job: Job) {
  const adapter = SOURCES[job.source];
  if (!adapter.extract) throw new HttpError(422, "File imports are read on upload.");
  if (job.extracted) return { done: true, staged: job.totals.staged };
  const cred = await freshCredentials(db, job);
  let page;
  try {
    page = await adapter.extract(cred, job.entity, job.cursor);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed.";
    await db.update(s.migrationJobs).set({ status: "failed", error: message }).where(eq(s.migrationJobs.id, job.id));
    await log(db, job, "extract", message, { level: "error" });
    throw new HttpError(502, message);
  }
  const { staged, fields } = page.records.length ? await stage(db, job, page.records) : { staged: job.totals.staged, fields: job.sourceFields };
  await log(db, job, "extract", `Read ${page.records.length} records${page.total ? ` of ${page.total.toLocaleString("en-US")}` : ""}.`);
  if (!page.next) {
    await finishExtract(db, job, fields, staged);
    return { done: true, staged };
  }
  await db.update(s.migrationJobs).set({ cursor: page.next, sourceFields: fields, account: job.account ?? page.account ?? null, totals: { ...job.totals, staged } }).where(eq(s.migrationJobs.id, job.id));
  return { done: false, staged };
}

/* ---------------------------------------------------------------- mapping */

export async function rules(db: DB, jobId: string): Promise<MappingRule[]> {
  const maps = await db.select().from(s.migrationFieldMaps).where(eq(s.migrationFieldMaps.jobId, jobId)).orderBy(asc(s.migrationFieldMaps.position));
  return maps.map((m) => ({ sourceField: m.sourceField, targetField: m.targetField, transform: m.transform, valueMap: m.valueMap }));
}

export async function saveMapping(db: DB, job: Job, next: MappingRule[]) {
  if (["running", "completed", "rolled_back"].includes(job.status)) throw new HttpError(409, "The mapping is fixed once loading starts.");
  const known = new Set(job.sourceFields);
  const bad = next.find((r) => !known.has(r.sourceField));
  if (bad) throw new HttpError(422, `"${bad.sourceField}" is not a field in this source.`);
  await db.delete(s.migrationFieldMaps).where(eq(s.migrationFieldMaps.jobId, job.id));
  if (next.length) await db.insert(s.migrationFieldMaps).values(next.map((r, i) => ({ tenantId: job.tenantId, jobId: job.id, sourceField: r.sourceField, targetField: r.targetField, transform: r.transform, valueMap: r.valueMap ?? {}, position: i })));
  await db.update(s.migrationJobs).set({ status: "mapping", dryRunTotals: null }).where(eq(s.migrationJobs.id, job.id));
  await log(db, job, "map", `Mapping saved: ${next.length} fields.`);
}

const build = (job: Job, r: MappingRule[], data: Record<string, string>) => (job.entity === "listings" ? buildListing(r, data, job.defaultMarket as MarketCode) : buildLead(r, data, job.defaultMarket as MarketCode, job.source === "csv" ? "website" : job.source));

export async function preview(db: DB, job: Job, limit = 25) {
  const r = await rules(db, job.id);
  const rows = await db.select().from(s.migrationRows).where(eq(s.migrationRows.jobId, job.id)).orderBy(asc(s.migrationRows.rowNumber)).limit(limit);
  return rows.map((row) => ({ rowNumber: row.rowNumber, source: row.data, result: build(job, r, row.data) }));
}

/* ------------------------------------------------------- dry run and load */

async function existingKeys(db: DB, tenantId: string, keys: string[]) {
  const emails = keys.filter((k) => k.startsWith("e:")).map((k) => k.slice(2));
  const phones = keys.filter((k) => k.startsWith("p:")).map((k) => k.slice(2));
  if (!emails.length && !phones.length) return new Set<string>();
  const conds = [emails.length ? inArray(sql`lower(${s.leads.email})`, emails) : undefined, phones.length ? inArray(sql`regexp_replace(coalesce(${s.leads.phone}, ''), '[^0-9]', '', 'g')`, phones) : undefined].filter(Boolean);
  const found = await db.select({ email: s.leads.email, phone: s.leads.phone }).from(s.leads).where(scope(s.leads, tenantId, or(...conds)));
  return new Set(found.flatMap((f) => leadKeys(f)));
}

async function existingListingRefs(db: DB, tenantId: string, refs: string[]) {
  if (!refs.length) return new Set<string>();
  const found = await db.select({ permit: s.listings.permitNumber }).from(s.listings).where(scope(s.listings, tenantId, inArray(s.listings.permitNumber, refs)));
  return new Set(found.map((f) => f.permit!));
}

/** Validates every staged row against the mapping and the firm's existing records. Writes nothing but the summary. */
export async function dryRun(db: DB, job: Job) {
  if (!job.extracted) throw new HttpError(409, "Extraction has not finished.");
  const r = await rules(db, job.id);
  if (!r.length) throw new HttpError(422, "Map at least one field first.");
  const totals = { ...ZERO, staged: job.totals.staged };
  const seen = new Set<string>();
  const issues: { rowNumber: number; level: "warning" | "error"; message: string }[] = [];
  for (let offset = 0; ; offset += 1000) {
    const rows = await db.select().from(s.migrationRows).where(eq(s.migrationRows.jobId, job.id)).orderBy(asc(s.migrationRows.rowNumber)).limit(1000).offset(offset);
    if (!rows.length) break;
    const built = rows.map((row) => ({ row, res: build(job, r, row.data) }));
    const dupes =
      job.entity === "leads"
        ? await existingKeys(db, job.tenantId, built.flatMap((b) => (b.res.ok ? leadKeys(b.res.record as { email: string | null; phone: string | null }) : [])))
        : await existingListingRefs(db, job.tenantId, built.flatMap((b) => (b.res.ok && (b.res.record as { permit: string | null }).permit ? [(b.res.record as { permit: string }).permit] : [])));
    for (const { row, res } of built) {
      totals.processed++;
      if (!res.ok) {
        totals.failed++;
        if (issues.length < 500) issues.push({ rowNumber: row.rowNumber, level: "error", message: res.errors.join(" ") });
        continue;
      }
      const keys = job.entity === "leads" ? leadKeys(res.record as { email: string | null; phone: string | null }) : [(res.record as { permit: string | null }).permit].filter((x): x is string => Boolean(x));
      if (keys.some((k) => dupes.has(k) || seen.has(k))) {
        totals.skipped++;
        if (issues.length < 500) issues.push({ rowNumber: row.rowNumber, level: "warning", message: "Duplicate of an existing record or an earlier row; it will be skipped." });
        continue;
      }
      keys.forEach((k) => seen.add(k));
      totals.created++;
      if (res.warnings.length && issues.length < 500) issues.push({ rowNumber: row.rowNumber, level: "warning", message: res.warnings.join("; ") });
    }
  }
  await db.delete(s.migrationLogs).where(and(eq(s.migrationLogs.jobId, job.id), eq(s.migrationLogs.phase, "dry_run")));
  for (let i = 0; i < issues.length; i += 200)
    await db.insert(s.migrationLogs).values(issues.slice(i, i + 200).map((x) => ({ tenantId: job.tenantId, jobId: job.id, phase: "dry_run" as const, level: x.level, rowNumber: x.rowNumber, message: x.message })));
  await log(db, job, "dry_run", `Dry run: ${totals.created} would be created, ${totals.skipped} skipped as duplicates, ${totals.failed} rejected.`);
  await db.update(s.migrationJobs).set({ status: "ready", dryRunTotals: totals }).where(eq(s.migrationJobs.id, job.id));
  return totals;
}

async function nextNumber(db: DB, tenantId: string, entity: MigrationEntity) {
  const t = entity === "listings" ? s.listings : s.leads;
  const [r] = await db.select({ n: sql<number>`coalesce(max(nullif(regexp_replace(${t.reference}, '[^0-9]', '', 'g'), '')::int), 0)::int` }).from(t).where(eq(t.tenantId, tenantId));
  return r?.n ?? 0;
}

/** Loads one batch. Call until `done`. */
export async function loadStep(db: DB, job: Job, actor: Actor) {
  if (job.status === "completed" || job.status === "rolled_back") return { done: true, totals: job.totals };
  if (job.status !== "ready" && job.status !== "running") throw new HttpError(409, "Run the dry run before loading.");
  const r = await rules(db, job.id);
  const rows = await db.select().from(s.migrationRows).where(and(eq(s.migrationRows.jobId, job.id), eq(s.migrationRows.state, "staged"))).orderBy(asc(s.migrationRows.rowNumber)).limit(LOAD_BATCH);
  const totals: MigrationTotals = job.status === "ready" ? { ...ZERO, staged: job.totals.staged } : { ...job.totals };
  if (job.status === "ready") {
    await db.update(s.migrationJobs).set({ status: "running", startedAt: new Date() }).where(eq(s.migrationJobs.id, job.id));
    await log(db, job, "load", `Loading started by ${actor.name}.`);
  }
  const staff = await db.select({ id: s.users.id }).from(s.users).where(and(eq(s.users.tenantId, job.tenantId), sql`${s.users.role} in ('analyst','tenant_admin')`)).orderBy(s.users.createdAt);
  let seq = await nextNumber(db, job.tenantId, job.entity);
  const now = Date.now();
  const built = rows.map((row) => ({ row, res: build(job, r, row.data) }));
  const dupes =
    job.entity === "leads"
      ? await existingKeys(db, job.tenantId, built.flatMap((b) => (b.res.ok ? leadKeys(b.res.record as { email: string | null; phone: string | null }) : [])))
      : await existingListingRefs(db, job.tenantId, built.flatMap((b) => (b.res.ok && (b.res.record as { permit: string | null }).permit ? [(b.res.record as { permit: string }).permit] : [])));
  const seen = new Set<string>();
  const failures: (typeof s.migrationLogs.$inferInsert)[] = [];
  for (const { row, res } of built) {
    totals.processed++;
    if (!res.ok) {
      totals.failed++;
      failures.push({ tenantId: job.tenantId, jobId: job.id, phase: "load", level: "error", rowNumber: row.rowNumber, message: res.errors.join(" ") });
      await db.update(s.migrationRows).set({ state: "failed" }).where(eq(s.migrationRows.id, row.id));
      continue;
    }
    if (job.entity === "leads") {
      const l = res.record as LeadDraft;
      const keys = leadKeys(l);
      if (keys.some((k) => dupes.has(k) || seen.has(k))) {
        totals.skipped++;
        await db.update(s.migrationRows).set({ state: "skipped" }).where(eq(s.migrationRows.id, row.id));
        continue;
      }
      keys.forEach((k) => seen.add(k));
      const market = MARKETS[l.market];
      const created = l.createdAt && l.createdAt.getTime() < now ? l.createdAt : new Date(now);
      const scored = scoreLead({ email: l.email, phone: l.phone, intent: l.intent, timeline: l.timeline, source: l.source, budgetMin: l.budgetMin, budgetMax: l.budgetMax, listingPrice: null, recentEngagements: 0, daysSinceContact: null, daysSinceCreated: Math.floor((now - created.getTime()) / 86_400_000) });
      const [lead] = await db
        .insert(s.leads)
        .values({
          tenantId: job.tenantId,
          reference: `LD-${String(++seq).padStart(4, "0")}`,
          name: l.name,
          email: l.email,
          phone: l.phone,
          source: l.source,
          sourceRef: l.externalId ? `${job.source}:${l.externalId}`.slice(0, 120) : `${job.reference}:${row.rowNumber}`,
          market: market.code,
          intent: l.intent,
          timeline: l.timeline,
          stage: l.stage,
          propertyType: l.propertyType,
          budgetMin: l.budgetMin,
          budgetMax: l.budgetMax,
          currency: market.currency,
          locations: l.locations,
          message: l.message,
          score: scored.score,
          scoreFactors: scored.factors,
          ownerUserId: staff.length ? staff[(seq - 1) % staff.length]!.id : null,
          consentMarketing: l.consentMarketing,
          nextAction: l.stage === "won" || l.stage === "lost" ? null : "Review imported lead",
          createdAt: created,
        })
        .returning({ id: s.leads.id });
      await db.insert(s.leadActivities).values({ tenantId: job.tenantId, leadId: lead!.id, type: "inbound", summary: `Imported from ${SOURCES[job.source].name} (${job.reference}${job.fileName ? `, ${job.fileName}` : ""}, row ${row.rowNumber}); original source ${SOURCE_NAME[l.source] ?? l.source}`, userId: actor.id, occurredAt: created });
      await db.update(s.migrationRows).set({ state: "created", entityId: lead!.id }).where(eq(s.migrationRows.id, row.id));
    } else {
      const l = res.record as ListingDraft;
      const key = l.permit;
      if (key && (dupes.has(key) || seen.has(key))) {
        totals.skipped++;
        await db.update(s.migrationRows).set({ state: "skipped" }).where(eq(s.migrationRows.id, row.id));
        continue;
      }
      if (key) seen.add(key);
      const market = MARKETS[l.market];
      const [listing] = await db
        .insert(s.listings)
        .values({ tenantId: job.tenantId, reference: `LS-${String(++seq).padStart(4, "0")}`, title: l.title, market: market.code, city: l.city, community: l.community, propertyType: l.propertyType, purpose: l.purpose, status: l.status, price: l.price, currency: market.currency, rentPeriod: l.purpose === "rent" ? (market.code === "AE" ? "annual" : "monthly") : null, bedrooms: l.bedrooms, bathrooms: l.bathrooms, area: l.area, areaUnit: market.areaUnit, permitNumber: l.permit, description: l.description, agentUserId: staff.length ? staff[(seq - 1) % staff.length]!.id : null, listedAt: l.status === "draft" ? null : new Date(now) })
        .returning({ id: s.listings.id });
      await db.update(s.migrationRows).set({ state: "created", entityId: listing!.id }).where(eq(s.migrationRows.id, row.id));
    }
    totals.created++;
  }
  if (failures.length) await db.insert(s.migrationLogs).values(failures);
  const [left] = await db.select({ n: sql<number>`count(*)::int` }).from(s.migrationRows).where(and(eq(s.migrationRows.jobId, job.id), eq(s.migrationRows.state, "staged")));
  const done = (left?.n ?? 0) === 0;
  await db
    .update(s.migrationJobs)
    .set(done ? { totals, status: "completed", finishedAt: new Date(), rollbackUntil: new Date(Date.now() + ROLLBACK_HOURS * 3_600_000) } : { totals })
    .where(eq(s.migrationJobs.id, job.id));
  if (done) await log(db, job, "load", `Import complete: ${totals.created} created, ${totals.skipped} skipped, ${totals.failed} rejected. It can be rolled back for ${ROLLBACK_HOURS} hours.`);
  return { done, totals };
}

/** Deletes every record the import created, within the rollback window. */
export async function rollback(db: DB, job: Job, actor: Actor) {
  if (job.status !== "completed" && job.status !== "running") throw new HttpError(409, "Only a running or completed import can be rolled back.");
  if (job.rollbackUntil && job.rollbackUntil.getTime() < Date.now()) throw new HttpError(409, `The ${ROLLBACK_HOURS}-hour rollback window closed on ${job.rollbackUntil.toISOString().slice(0, 16).replace("T", " ")} UTC.`);
  const created = await db.select({ id: s.migrationRows.entityId }).from(s.migrationRows).where(and(eq(s.migrationRows.jobId, job.id), eq(s.migrationRows.state, "created")));
  const ids = created.map((c) => c.id).filter((x): x is string => Boolean(x));
  const t = job.entity === "listings" ? s.listings : s.leads;
  for (let i = 0; i < ids.length; i += 500) await db.delete(t).where(scope(t, job.tenantId, inArray(t.id, ids.slice(i, i + 500))));
  await db.update(s.migrationRows).set({ state: "staged", entityId: null }).where(eq(s.migrationRows.jobId, job.id));
  await db.update(s.migrationJobs).set({ status: "rolled_back", rolledBackAt: new Date() }).where(eq(s.migrationJobs.id, job.id));
  await log(db, job, "rollback", `Rolled back by ${actor.name}: ${ids.length} records deleted.`, { level: "warning" });
  return { deleted: ids.length };
}

export async function listJobs(db: DB, tenantId: string) {
  return db.select().from(s.migrationJobs).where(scope(s.migrationJobs, tenantId)).orderBy(desc(s.migrationJobs.createdAt)).limit(50);
}

export async function jobLogs(db: DB, jobId: string, limit = 200) {
  return db.select().from(s.migrationLogs).where(eq(s.migrationLogs.jobId, jobId)).orderBy(desc(s.migrationLogs.occurredAt), desc(s.migrationLogs.rowNumber)).limit(limit);
}

/** The most common values of a source field, for building a value map. */
export async function distinctValues(db: DB, jobId: string, field: string, limit = 15) {
  const v = sql<string>`${s.migrationRows.data} ->> ${field}`;
  const rows = await db
    .select({ value: v, n: sql<number>`count(*)::int` })
    .from(s.migrationRows)
    .where(and(eq(s.migrationRows.jobId, jobId), sql`coalesce(${v}, '') <> ''`))
    // Grouped by position: a bound parameter repeated in GROUP BY is a different expression to Postgres.
    .groupBy(sql`1`)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
  return rows;
}
