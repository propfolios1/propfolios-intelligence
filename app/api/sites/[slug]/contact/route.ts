import { and, eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { handle, parseBody } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { createLead } from "@/lib/brokerage/leads";
import { greetNewLead } from "@/lib/lead-response/service";
import { enforcePublicRateLimit } from "@/lib/rate-limit";
import { siteBySlug } from "@/lib/website/service";

const body = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200).or(z.literal("")).optional(), phone: z.string().trim().max(40).optional(), message: z.string().trim().max(2000).optional(), consent: z.boolean().optional(), listingId: z.string().uuid().optional() });

/** Website enquiries become leads, sourced to the firm's website and linked to the listing when there is one. */
export const POST = handle(async (req: Request, { params }: { params: Promise<{ slug: string }> }) => {
  await enforcePublicRateLimit(req, "sign");
  const db = await getDb();
  const cfg = await siteBySlug(db, (await params).slug);
  if (!cfg || !cfg.publishedAt) throw new HttpError(404, "Site not found.");
  const b = await parseBody(req, body);
  if (!b.email && !b.phone) throw new HttpError(422, "Leave an email address or a phone number so an agent can reply.");
  const [listing] = b.listingId ? await db.select().from(s.listings).where(and(eq(s.listings.tenantId, cfg.tenantId), eq(s.listings.id, b.listingId))) : [];
  const [anyListing] = listing ? [listing] : await db.select({ market: s.listings.market }).from(s.listings).where(eq(s.listings.tenantId, cfg.tenantId)).limit(1);
  const lead = await createLead(db, cfg.tenantId, { name: b.name, email: b.email || null, phone: b.phone || null, source: "website", market: anyListing?.market ?? "AE", intent: listing ? (listing.purpose === "rent" ? "rent" : "buy") : "buy", listingId: listing?.id ?? null, message: b.message || null, consentMarketing: b.consent ?? false }, { name: "Website" });
  // The assistant's first reply goes out after the response, so the form returns at once.
  after(async () => {
    await greetNewLead(await getDb(), cfg.tenantId, lead.id, "website").catch(() => undefined);
  });
  return NextResponse.json({ ok: true, reference: lead.reference }, { status: 201 });
});
