import { and, eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle } from "@/lib/api";
import { userFromApiKey } from "@/lib/api-keys";
import { HttpError } from "@/lib/auth";
import { createLead, normaliseInbound } from "@/lib/brokerage/leads";
import { greetNewLead } from "@/lib/lead-response/service";
import { LEAD_SOURCES } from "@/lib/markets";
import { enforceRateLimit } from "@/lib/rate-limit";

const SOURCES = new Set(LEAD_SOURCES.map((x) => x.key));

/**
 * Inbound lead capture. A portal, a website form or an email-to-webhook
 * forwarder posts the enquiry with the firm's API key; the payload is mapped,
 * matched to the listing by reference, assigned, scored and logged.
 */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ portal: string }> }) => {
  const user = await userFromApiKey(req);
  if (!user) throw new HttpError(401, "A valid API key is required: Authorization: Bearer nk_live_…");
  await enforceRateLimit(user, "write");
  const { portal } = await params;
  if (!SOURCES.has(portal)) throw new HttpError(404, `Unknown lead source "${portal}".`);
  const raw = (await req.json().catch(() => {
    throw new HttpError(400, "Request body must be JSON.");
  })) as Record<string, unknown>;
  const n = normaliseInbound(portal, raw);
  if (!n.email && !n.phone) throw new HttpError(422, "The enquiry has no email address or phone number.");
  const db = await getDb();
  const [listing] = n.listingReference ? await db.select({ id: s.listings.id, market: s.listings.market }).from(s.listings).where(and(eq(s.listings.tenantId, user.tenantId), eq(s.listings.reference, n.listingReference))).limit(1) : [];
  const lead = await createLead(db, user.tenantId, { name: n.name, email: n.email, phone: n.phone, source: portal, sourceRef: n.sourceRef, market: listing?.market ?? n.market, intent: n.intent, budgetMax: n.budgetMax, listingId: listing?.id ?? null, message: n.message }, { id: null, name: user.name });
  await audit(user, `received lead from ${portal}`, { entityType: "lead", entityId: lead.id, detail: { portal, matchedListing: Boolean(listing) } });
  after(async () => {
    await greetNewLead(await getDb(), user.tenantId, lead.id, portal === "website" ? "website" : "portal").catch(() => undefined);
  });
  return NextResponse.json({ id: lead.id, reference: lead.reference, matchedListing: Boolean(listing) }, { status: 201 });
});
