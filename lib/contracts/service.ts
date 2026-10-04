import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { DB } from "@/db";
import * as s from "@/db/schema";
import type { TemplateInput } from "@/db/schema-production";
import { embed } from "@/lib/ai/embed";
import { HttpError } from "@/lib/auth";
import { contentHash } from "@/lib/deals/signature";
import { scope } from "@/lib/tenant-db";
import { type Ctx, parse, render, TemplateError, variablesOf } from "./engine";
import { BUILT_INS } from "./templates";

type Template = typeof s.contractTemplates.$inferSelect;
const DAY = 86_400_000;

/** Installs the built-in templates into a workspace once, as published version 1. */
export async function ensureTemplates(db: DB, tenantId: string) {
  const [any] = await db.select({ id: s.contractTemplates.id }).from(s.contractTemplates).where(scope(s.contractTemplates, tenantId)).limit(1);
  if (any) return false;
  await db
    .insert(s.contractTemplates)
    .values(BUILT_INS.map((b) => ({ tenantId, family: b.key, builtIn: b.key, name: b.name, jurisdiction: b.jurisdiction, kind: b.kind, parties: b.parties, description: b.description, officialNote: b.officialNote, body: b.body.trim(), inputs: b.inputs, version: 1, status: "published" as const, publishedAt: new Date(), changeNote: "Installed from the Nakhla template library." })))
    .onConflictDoNothing();
  return true;
}

/** The current version of every template family: the draft if one is open, otherwise the published one. */
export async function listTemplates(db: DB, tenantId: string) {
  await ensureTemplates(db, tenantId);
  const rows = await db.select().from(s.contractTemplates).where(scope(s.contractTemplates, tenantId)).orderBy(desc(s.contractTemplates.version));
  const families = new Map<string, { published: Template | null; draft: Template | null; versions: number }>();
  for (const r of rows) {
    const f = families.get(r.family) ?? { published: null, draft: null, versions: 0 };
    f.versions++;
    if (r.status === "published" && !f.published) f.published = r;
    if (r.status === "draft" && !f.draft) f.draft = r;
    families.set(r.family, f);
  }
  return [...families.entries()].map(([family, f]) => ({ family, ...f, current: (f.draft ?? f.published)! })).filter((x) => x.current);
}

export async function getTemplate(db: DB, tenantId: string, id: string) {
  const [t] = await db.select().from(s.contractTemplates).where(scope(s.contractTemplates, tenantId, eq(s.contractTemplates.id, id)));
  if (!t) throw new HttpError(404, "Template not found.");
  const versions = await db.select().from(s.contractTemplates).where(scope(s.contractTemplates, tenantId, eq(s.contractTemplates.family, t.family))).orderBy(desc(s.contractTemplates.version));
  return { template: t, versions };
}

export function validateBody(body: string) {
  try {
    parse(body);
    return null;
  } catch (e) {
    if (e instanceof TemplateError) return `${e.message} (at character ${e.position + 1})`;
    throw e;
  }
}

export async function createTemplate(db: DB, tenantId: string, b: { name: string; jurisdiction: Template["jurisdiction"]; fromId?: string | null }) {
  const src = b.fromId ? (await getTemplate(db, tenantId, b.fromId)).template : null;
  const custom = BUILT_INS.find((x) => x.key === "custom")!;
  const family = `${b.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 7)}`;
  const [t] = await db
    .insert(s.contractTemplates)
    .values({ tenantId, family, builtIn: null, name: b.name, jurisdiction: b.jurisdiction, kind: src?.kind ?? "custom", parties: src?.parties ?? custom.parties, description: src ? `Based on ${src.name}.` : custom.description, officialNote: src?.officialNote ?? custom.officialNote, body: src?.body ?? custom.body.trim(), inputs: src?.inputs ?? [], version: 1, status: "draft" })
    .returning();
  return t!;
}

/** Edits a draft in place; editing a published version opens a new draft version in the same family. */
export async function editTemplate(db: DB, tenantId: string, id: string, patch: { name?: string; description?: string; body?: string; inputs?: TemplateInput[] }) {
  const { template: t, versions } = await getTemplate(db, tenantId, id);
  if (patch.body !== undefined) {
    const err = validateBody(patch.body);
    if (err) throw new HttpError(422, err);
  }
  if (t.status === "draft") {
    const [u] = await db.update(s.contractTemplates).set({ ...patch }).where(eq(s.contractTemplates.id, t.id)).returning();
    return u!;
  }
  const open = versions.find((v) => v.status === "draft");
  if (open) {
    const [u] = await db.update(s.contractTemplates).set({ ...patch }).where(eq(s.contractTemplates.id, open.id)).returning();
    return u!;
  }
  const [d] = await db
    .insert(s.contractTemplates)
    .values({ tenantId, family: t.family, builtIn: t.builtIn, name: patch.name ?? t.name, jurisdiction: t.jurisdiction, kind: t.kind, parties: t.parties, description: patch.description ?? t.description, officialNote: t.officialNote, body: patch.body ?? t.body, inputs: patch.inputs ?? t.inputs, version: Math.max(...versions.map((v) => v.version)) + 1, status: "draft" })
    .returning();
  return d!;
}

export async function publishTemplate(db: DB, tenantId: string, id: string, b: { note: string; userId: string }) {
  const { template: t } = await getTemplate(db, tenantId, id);
  if (t.status !== "draft") throw new HttpError(409, "Only a draft can be published.");
  const err = validateBody(t.body);
  if (err) throw new HttpError(422, err);
  await db.update(s.contractTemplates).set({ status: "archived" }).where(scope(s.contractTemplates, tenantId, eq(s.contractTemplates.family, t.family), eq(s.contractTemplates.status, "published")));
  const [u] = await db.update(s.contractTemplates).set({ status: "published", publishedAt: new Date(), publishedBy: b.userId, changeNote: b.note }).where(eq(s.contractTemplates.id, t.id)).returning();
  return u!;
}

/* ------------------------------------------------------------- context */

const isNri = (p: { residency?: string | null; nationality?: string | null }) => /\bnri\b|non-resident|oci/i.test(p.residency ?? "") || (/indian/i.test(p.nationality ?? "") && !!p.residency && !/india/i.test(p.residency));
const isCompany = (name: string, type?: string | null) => /family office|company/i.test(type ?? "") || /\b(llc|ltd|limited|fze|fzco|plc|pvt|inc|holdings|llp)\b/i.test(name);

function setPath(o: Ctx, path: string, v: unknown) {
  const keys = path.split(".");
  let cur = o;
  for (const k of keys.slice(0, -1)) {
    if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
    cur = cur[k] as Ctx;
  }
  cur[keys.at(-1)!] = v;
}

export async function firmVariables(db: DB, tenantId: string) {
  return db.select().from(s.contractVariables).where(scope(s.contractVariables, tenantId)).orderBy(s.contractVariables.path);
}

export async function setFirmVariable(db: DB, tenantId: string, b: { path: string; label: string; value: string }) {
  if (!/^[a-z][\w]*(\.[a-z][\w]*)*$/i.test(b.path)) throw new HttpError(422, "Use a dotted name such as firm.orn.");
  const [r] = await db
    .insert(s.contractVariables)
    .values({ tenantId, ...b })
    .onConflictDoUpdate({ target: [s.contractVariables.tenantId, s.contractVariables.path], set: { label: b.label, value: b.value } })
    .returning();
  return r!;
}

/** The values a template sees for a deal: parties, property, price and terms, the firm's variables, then anything entered by hand. */
export async function dealContext(db: DB, tenantId: string, dealId: string | null, values: Record<string, unknown> = {}, now = new Date()): Promise<Ctx> {
  const ctx: Ctx = { date: now.toISOString().slice(0, 10), conditions: [] };
  const [tenant] = await db.select({ name: s.tenants.name }).from(s.tenants).where(eq(s.tenants.id, tenantId));
  setPath(ctx, "firm.name", tenant?.name ?? "");
  if (dealId) {
    const [row] = await db
      .select({ d: s.deals, client: s.clients, prop: s.properties, owner: s.users })
      .from(s.deals)
      .innerJoin(s.clients, eq(s.clients.id, s.deals.clientId))
      .innerJoin(s.properties, eq(s.properties.id, s.deals.propertyId))
      .leftJoin(s.users, eq(s.users.id, s.deals.ownerUserId))
      .where(scope(s.deals, tenantId, eq(s.deals.id, dealId)));
    if (!row) throw new HttpError(404, "Deal not found.");
    const [accepted] = await db.select().from(s.offers).where(scope(s.offers, tenantId, eq(s.offers.dealId, dealId), eq(s.offers.status, "accepted"))).orderBy(desc(s.offers.responseAt)).limit(1);
    const price = accepted?.amount ?? row.d.value;
    const depositPct = accepted?.terms?.depositPct ?? 10;
    const completionDays = accepted?.terms?.completionDays ?? (row.d.jurisdiction === "dubai" ? 30 : 45);
    const client = { name: row.client.name, nationality: row.client.nationality, residency: row.client.residency, isNri: isNri(row.client), isCompany: isCompany(row.client.name, row.client.type) };
    const other = { name: row.d.counterparty, isNri: false, isCompany: isCompany(row.d.counterparty) };
    Object.assign(ctx, {
      reference: row.d.reference,
      currency: row.d.currency,
      price,
      depositPct,
      deposit: Math.round(price * depositPct) / 100,
      balance: Math.round(price * (100 - depositPct)) / 100,
      completionDays,
      completionDate: new Date(now.getTime() + completionDays * DAY).toISOString().slice(0, 10),
      conditions: accepted?.terms?.conditions ?? [],
      buyer: row.d.side === "buy" ? client : other,
      seller: row.d.side === "buy" ? other : client,
      property: { name: row.prop.name, community: row.prop.community, city: row.prop.city, permit: row.prop.reraNumber },
      reraNumber: row.prop.reraNumber,
      agent: { name: row.owner?.name ?? "", email: row.owner?.email ?? "" },
      commission: { vatPct: row.d.jurisdiction === "mumbai" || row.d.jurisdiction === "goa" ? 18 : 5 },
    });
    setPath(ctx, "firm.name", tenant?.name ?? "");
  }
  for (const v of await firmVariables(db, tenantId)) setPath(ctx, v.path, /^-?\d+(\.\d+)?$/.test(v.value) ? Number(v.value) : v.value);
  for (const [k, v] of Object.entries(values)) if (v !== "" && v !== null && v !== undefined) setPath(ctx, k, v);
  return ctx;
}

export async function previewTemplate(db: DB, tenantId: string, b: { body: string; dealId?: string | null; values?: Record<string, unknown> }) {
  const err = validateBody(b.body);
  if (err) return { error: err, html: "", missing: [] as string[], variables: [] as string[] };
  const ctx = await dealContext(db, tenantId, b.dealId ?? null, b.values ?? {});
  const r = render(b.body, ctx);
  return { error: null, html: r.html, missing: r.missing, variables: variablesOf(b.body) };
}

/** Drafts a deal contract from the published version of a template. The contract then follows the deal's signature flow. */
export async function draftFromTemplate(db: DB, tenantId: string, user: { id: string; name: string }, b: { dealId: string; templateId: string; values: Record<string, unknown> }) {
  const { template: t, versions } = await getTemplate(db, tenantId, b.templateId);
  const pub = t.status === "published" ? t : versions.find((v) => v.status === "published");
  if (!pub) throw new HttpError(409, "Publish the template before drafting contracts from it.");
  const [deal] = await db.select().from(s.deals).where(scope(s.deals, tenantId, eq(s.deals.id, b.dealId)));
  if (!deal) throw new HttpError(404, "Deal not found.");
  const defaults = Object.fromEntries(pub.inputs.filter((i) => i.default !== undefined).map((i) => [i.path, i.default]));
  const values = { ...defaults, ...b.values };
  const ctx = await dealContext(db, tenantId, b.dealId, values);
  const r = render(pub.body, ctx);
  const [prev] = await db.select({ n: sql<number>`coalesce(max(${s.contracts.version}), 0)::int` }).from(s.contracts).where(scope(s.contracts, tenantId, eq(s.contracts.dealId, b.dealId), eq(s.contracts.title, pub.name)));
  const html = `${r.html}<p class="template-provenance">Drafted from "${pub.name}", template version ${pub.version}.</p>`;
  const [c] = await db
    .insert(s.contracts)
    .values({ tenantId, dealId: b.dealId, type: "template", title: pub.name, contentHtml: html, version: (prev?.n ?? 0) + 1, status: "draft", contentHash: contentHash(html), createdBy: user.name, embedding: embed(html.replace(/<[^>]+>/g, " ")) })
    .returning();
  const [inst] = await db
    .insert(s.contractInstances)
    .values({ tenantId, templateId: pub.id, templateVersion: pub.version, dealId: b.dealId, contractId: c!.id, clientId: deal.clientId, title: pub.name, values, missing: r.missing, renderedHtml: html, contentHash: c!.contentHash, createdBy: user.id })
    .returning();
  return { contract: c!, instance: inst!, missing: r.missing };
}

export async function clientContracts(db: DB, tenantId: string, clientId: string) {
  return db
    .select({ c: s.contracts, deal: s.deals.title, ref: s.deals.reference })
    .from(s.contracts)
    .innerJoin(s.deals, eq(s.deals.id, s.contracts.dealId))
    .where(and(scope(s.contracts, tenantId), eq(s.deals.clientId, clientId)))
    .orderBy(desc(s.contracts.createdAt));
}
