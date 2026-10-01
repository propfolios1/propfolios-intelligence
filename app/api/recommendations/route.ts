import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { recommender } from "@/lib/ai/agents";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { assertClientAccess, getPortfolio, listProperties, listRecommendations } from "@/lib/queries";

export const maxDuration = 120;

export const GET = handle(async (req: Request) => {
  const user = await requireApiUser();
  const q = z.object({ clientId: z.uuid().optional(), status: z.enum(["open", "dismissed", "actioned"]).optional() }).parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listRecommendations(await getDb(), user, q));
});

/** Runs the recommender agent for a client and stores new recommendations. Staff only. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["admin", "analyst"]);
  const { clientId } = await parseBody(req, z.object({ clientId: z.uuid() }));
  const db = await getDb();
  const p = await getPortfolio(db, user, clientId);
  const held = new Set(p.holdings.map((h) => h.propertyId));
  const catalogue = (await listProperties(db, {})).filter((x) => !held.has(x.id) && p.client.policy.markets.includes(x.market) && x.status === "ready").sort((a, b) => b.grossYield - a.grossYield).slice(0, 8);
  const run = await recommender(
    {
      client: { name: p.client.name, residency: p.client.residency, policy: JSON.stringify(p.client.policy) },
      holdings: p.holdings.map((h) => ({ holdingId: h.id, property: h.property.name, community: h.property.community, developer: h.developerName, status: h.status, costAed: h.costAed, valueAed: h.currentValueAed, irr: h.irr, cashYield: h.cashYield })),
      opportunities: catalogue.map((x) => ({ propertyId: x.id, name: x.name, summary: `${x.community}, ${x.city}. ${x.developerName}. Gross yield ${x.grossYield.toFixed(1)}%, from ${x.currency} ${Math.round(x.priceMin).toLocaleString("en-US")}.` })),
    },
    { tenantId: user.tenantId, actor: user.name, signal: req.signal },
  );
  const valid = new Set(catalogue.map((x) => x.id));
  const rows = run.output.recommendations.map((r) => ({ tenantId: user.tenantId, clientId, propertyId: r.propertyId && valid.has(r.propertyId) ? r.propertyId : null, type: r.type, title: r.title, message: r.message, rationale: r.rationale, priority: r.priority }));
  if (rows.length) await db.insert(s.recommendations).values(rows);
  await audit(user, `generated ${rows.length} recommendations for ${p.client.name}`, { entityType: "client", entityId: clientId });
  return NextResponse.json({ created: rows.length, replay: run.replay }, { status: 201 });
});

/** Dismiss or action a recommendation. Clients may act on their own. */
export const PATCH = handle(async (req: Request) => {
  const user = await requireApiUser();
  const { id, status } = await parseBody(req, z.object({ id: z.uuid(), status: z.enum(["open", "dismissed", "actioned"]) }));
  const db = await getDb();
  const [r] = await db.select().from(s.recommendations).where(and(eq(s.recommendations.id, id), eq(s.recommendations.tenantId, user.tenantId)));
  if (!r) throw new HttpError(404, "Recommendation not found.");
  assertClientAccess(user, r.clientId);
  const [updated] = await db.update(s.recommendations).set({ status }).where(eq(s.recommendations.id, id)).returning();
  await audit(user, `${status === "actioned" ? "requested follow-up on" : status === "dismissed" ? "dismissed" : "re-opened"} recommendation`, { entityType: "recommendation", entityId: id, detail: { title: r.title } });
  if (status === "actioned" && user.role === "client") {
    await db.insert(s.messages).values({ tenantId: user.tenantId, clientId: r.clientId, authorName: user.name, authorRole: "client", body: `I would like to discuss: ${r.title}.` });
  }
  return NextResponse.json(updated);
});
