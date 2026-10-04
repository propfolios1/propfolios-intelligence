import "server-only";
import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { InventoryMapping, SyncRun } from "@/db/schema-production";
import { HttpError } from "@/lib/auth";
import { request } from "@/lib/integrations/http";
import { openJson, seal } from "@/lib/integrations/vault";
import { notify } from "@/lib/os/notify";
import { scope } from "@/lib/tenant-db";
import { autoMap, recordsFrom, sandboxFeed, toUnits, type Unit } from "./adapters";
import { developerByKey } from "./catalogue";

type Conn = typeof s.developerConnections.$inferSelect;
const DAY = 86_400_000;

export async function connectDeveloper(db: DB, tenantId: string, b: { developerKey: string; mode: Conn["mode"]; url?: string | null; format?: "csv" | "json" | "xml" | null; mapping?: InventoryMapping; authHeader?: string | null }) {
  const dev = developerByKey(b.developerKey);
  if (!dev) throw new HttpError(404, "Unknown developer.");
  if ((b.mode === "feed_url" || b.mode === "json_api") && !b.url) throw new HttpError(422, "Enter the feed or API address the developer provided.");
  if (b.url && !/^https:\/\//.test(b.url)) throw new HttpError(422, "The feed address must use HTTPS.");
  const values = { tenantId, developerKey: dev.key, name: dev.name, market: dev.market, mode: b.mode, url: b.url ?? null, format: b.mode === "json_api" ? ("json" as const) : (b.format ?? null), mapping: b.mapping ?? {}, credentialsEncrypted: b.authHeader ? seal({ authorization: b.authHeader }) : null, status: "connected" as const, lastError: null };
  const [c] = await db.insert(s.developerConnections).values(values).onConflictDoUpdate({ target: [s.developerConnections.tenantId, s.developerConnections.developerKey], set: values }).returning();
  return c!;
}

async function fetchRecords(c: Conn, at: Date, upload: { body: string; format: "csv" | "json" | "xml" } | null, fetcher?: typeof fetch) {
  if (c.mode === "sandbox") return sandboxFeed(c.developerKey, c.name, c.market as "AE" | "IN", at);
  if (c.mode === "upload") {
    if (!upload) throw new HttpError(422, "Upload the developer's price list to sync this connection.");
    return recordsFrom(upload.body, upload.format);
  }
  const creds = openJson<{ authorization?: string }>(c.credentialsEncrypted);
  const body = await request<string>(c.name, c.url!, { headers: { accept: c.format === "csv" ? "text/csv" : c.format === "xml" ? "application/xml" : "application/json", ...(creds?.authorization ? { authorization: creds.authorization } : {}) }, timeoutMs: 30_000, fetcher });
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return recordsFrom(text, c.format ?? (text.trim().startsWith("<") ? "xml" : /^[[{]/.test(text.trim()) ? "json" : "csv"));
}

/**
 * Syncs one connection: reads the feed, normalises each unit and compares it
 * with the last sync. New units are added, price and status changes are kept
 * against the unit (with the previous price), and units missing from the feed
 * are marked withdrawn. A failed sync keeps the last good inventory.
 */
export async function syncConnection(db: DB, tenantId: string, id: string, opts: { now?: Date; upload?: { body: string; format: "csv" | "json" | "xml" }; fetcher?: typeof fetch } = {}) {
  const now = opts.now ?? new Date();
  const t0 = Date.now();
  const [c] = await db.select().from(s.developerConnections).where(scope(s.developerConnections, tenantId, eq(s.developerConnections.id, id)));
  if (!c) throw new HttpError(404, "Connection not found.");
  const record = async (run: SyncRun) => {
    await db
      .update(s.developerConnections)
      .set({ lastSyncAt: now, history: [run, ...c.history].slice(0, 30), status: run.ok ? "connected" : "error", lastError: run.error, ...(run.ok ? { units: run.units } : {}) })
      .where(eq(s.developerConnections.id, c.id));
    return run;
  };
  let units: Unit[];
  let rejected = 0;
  try {
    const records = await fetchRecords(c, now, opts.upload ?? null, opts.fetcher);
    if (!records.length) throw new Error("The feed contained no units.");
    const mapping = autoMap(Object.keys(records[0]!), c.mapping);
    if (!mapping.unitRef) throw new Error(`No unit number column found among: ${Object.keys(records[0]!).slice(0, 12).join(", ")}. Set the mapping for "Unit".`);
    ({ units, rejected } = toUnits(records, mapping, { currency: c.market === "IN" ? "INR" : "AED", project: c.name }));
  } catch (e) {
    return record({ at: now.toISOString(), ok: false, units: c.units, added: 0, priceChanges: 0, statusChanges: 0, removed: 0, ms: Date.now() - t0, error: (e as Error).message.slice(0, 300) });
  }
  const existing = await db.select().from(s.developerInventory).where(eq(s.developerInventory.connectionId, c.id));
  const byRef = new Map(existing.map((u) => [u.unitRef, u]));
  let added = 0;
  let priceChanges = 0;
  let statusChanges = 0;
  const newAvailable: Unit[] = [];
  for (const u of units) {
    const prev = byRef.get(u.unitRef);
    const fields = { project: u.project, building: u.building, unitType: u.unitType, bedrooms: u.bedrooms, areaSqft: u.areaSqft, currency: u.currency, floor: u.floor, view: u.view, handover: u.handover, paymentPlan: u.paymentPlan, raw: u.raw, lastSeenAt: now };
    if (!prev) {
      await db.insert(s.developerInventory).values({ tenantId, connectionId: c.id, developerKey: c.developerKey, unitRef: u.unitRef, ...fields, price: u.price, status: u.status, firstSeenAt: now });
      if (existing.length) added++;
      if (u.status === "available" && existing.length) newAvailable.push(u);
      continue;
    }
    const priceChanged = u.price !== null && prev.price !== null && Math.abs(u.price - prev.price) >= 1;
    const statusChanged = u.status !== prev.status;
    if (priceChanged) priceChanges++;
    if (statusChanged) statusChanges++;
    if (statusChanged && u.status === "available" && prev.status !== "available") newAvailable.push(u);
    await db
      .update(s.developerInventory)
      .set({ ...fields, price: u.price ?? prev.price, status: u.status, removedAt: null, ...(priceChanged ? { previousPrice: prev.price, priceChangedAt: now } : {}), ...(statusChanged ? { statusChangedAt: now } : {}) })
      .where(eq(s.developerInventory.id, prev.id));
  }
  const present = new Set(units.map((u) => u.unitRef));
  const gone = existing.filter((u) => !present.has(u.unitRef) && u.status !== "withdrawn");
  if (gone.length) await db.update(s.developerInventory).set({ status: "withdrawn", removedAt: now, statusChangedAt: now }).where(inArray(s.developerInventory.id, gone.map((g) => g.id)));
  const run = await record({ at: now.toISOString(), ok: true, units: units.length, added, priceChanges, statusChanges, removed: gone.length, ms: Date.now() - t0, error: rejected ? `${rejected} rows skipped (no unit number, or a duplicate)` : null });
  if (newAvailable.length) {
    await notify(db, { tenantId, roles: ["tenant_admin", "analyst"], category: "deals", title: `${c.name}: ${newAvailable.length} ${newAvailable.length === 1 ? "unit" : "units"} newly available`, body: newAvailable.slice(0, 3).map((u) => `${u.project} ${u.unitRef}${u.bedrooms !== null ? `, ${u.bedrooms === 0 ? "studio" : `${u.bedrooms} bed`}` : ""}`).join("; "), href: `/admin/developers/${c.developerKey}` }).catch(() => undefined);
  }
  return run;
}

/** The scheduled sync: every connection that reads from a feed, API or the sandbox (uploads are synced when uploaded). */
export async function syncAll(db: DB, opts: { now?: Date; tenantIds?: string[]; fetcher?: typeof fetch } = {}) {
  const conns = await db.select().from(s.developerConnections).where(and(inArray(s.developerConnections.mode, ["feed_url", "json_api", "sandbox"]), inArray(s.developerConnections.status, ["connected", "error"]), opts.tenantIds?.length ? inArray(s.developerConnections.tenantId, opts.tenantIds) : sql`true`));
  let ok = 0;
  let failed = 0;
  for (const c of conns) {
    const r = await syncConnection(db, c.tenantId, c.id, opts);
    if (r.ok) ok++;
    else failed++;
  }
  return { connections: conns.length, ok, failed };
}

/** Open leads whose budget reaches a unit's price (within 10%) without being far above it, and who want to buy or invest in the same market. */
export async function matchingLeads(db: DB, tenantId: string, unit: { price: number | null; currency: string }, market: string, limit = 5) {
  if (!unit.price) return [];
  return db
    .select({ id: s.leads.id, name: s.leads.name, budgetMax: s.leads.budgetMax, score: s.leads.score })
    .from(s.leads)
    .where(scope(s.leads, tenantId, eq(s.leads.market, market), inArray(s.leads.intent, ["buy", "invest"]), inArray(s.leads.stage, ["new", "contacted", "qualified", "viewing"]), gte(s.leads.budgetMax, unit.price * 0.9), lte(s.leads.budgetMax, unit.price * 1.6), or(isNull(s.leads.budgetMin), lte(s.leads.budgetMin, unit.price * 1.1))))
    .orderBy(desc(s.leads.score))
    .limit(limit);
}

export async function inventoryView(db: DB, tenantId: string, developerKey: string, f: { status?: string; bedrooms?: number | null; project?: string | null } = {}) {
  const [c] = await db.select().from(s.developerConnections).where(scope(s.developerConnections, tenantId, eq(s.developerConnections.developerKey, developerKey)));
  if (!c) return { connection: null, units: [], projects: [], changes: [] };
  const conds = [eq(s.developerInventory.connectionId, c.id)];
  if (f.status && f.status !== "all") conds.push(eq(s.developerInventory.status, f.status as "available"));
  if (f.bedrooms !== null && f.bedrooms !== undefined) conds.push(eq(s.developerInventory.bedrooms, f.bedrooms));
  if (f.project) conds.push(eq(s.developerInventory.project, f.project));
  const [units, projects, changes] = await Promise.all([
    db.select().from(s.developerInventory).where(scope(s.developerInventory, tenantId, ...conds)).orderBy(s.developerInventory.project, s.developerInventory.price).limit(400),
    db.select({ project: s.developerInventory.project, n: sql<number>`count(*)::int`, available: sql<number>`count(*) filter (where ${s.developerInventory.status} = 'available')::int`, minPrice: sql<number | null>`min(${s.developerInventory.price}) filter (where ${s.developerInventory.status} = 'available')` }).from(s.developerInventory).where(scope(s.developerInventory, tenantId, eq(s.developerInventory.connectionId, c.id))).groupBy(s.developerInventory.project),
    db.select().from(s.developerInventory).where(scope(s.developerInventory, tenantId, eq(s.developerInventory.connectionId, c.id), or(gte(s.developerInventory.priceChangedAt, new Date(Date.now() - 14 * DAY)), gte(s.developerInventory.statusChangedAt, new Date(Date.now() - 14 * DAY))))).orderBy(desc(sql`greatest(coalesce(${s.developerInventory.priceChangedAt}, 'epoch'), coalesce(${s.developerInventory.statusChangedAt}, 'epoch'))`)).limit(30),
  ]);
  return { connection: c, units, projects, changes };
}
