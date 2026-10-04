import { and, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { handle } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { verifyFeedToken } from "@/lib/brokerage/feed-token";
import { icsFeed } from "@/lib/lead-response/calendar";

/** An agent's viewings as an iCalendar feed, for Google Calendar, Outlook or Apple Calendar to subscribe to. */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ userId: string }> }) => {
  const { userId } = await params;
  const id = userId.replace(/\.ics$/, "");
  if (!/^[0-9a-f-]{36}$/i.test(id) || !verifyFeedToken(id, "calendar", new URL(req.url).searchParams.get("token"))) throw new HttpError(401, "Invalid calendar token.");
  const db = await getDb();
  const [u] = await db.select({ name: s.users.name, tenantId: s.users.tenantId }).from(s.users).where(eq(s.users.id, id));
  if (!u) throw new HttpError(404, "Calendar not found.");
  const rows = await db
    .select({ b: s.viewingBookings, lead: s.leads.name, ref: s.leads.reference, phone: s.leads.phone })
    .from(s.viewingBookings)
    .innerJoin(s.leads, eq(s.leads.id, s.viewingBookings.leadId))
    .where(and(eq(s.viewingBookings.tenantId, u.tenantId), eq(s.viewingBookings.agentUserId, id), gte(s.viewingBookings.startsAt, new Date(Date.now() - 30 * 86_400_000))));
  const body = icsFeed(`Viewings, ${u.name}`, rows.map(({ b, lead, ref, phone }) => ({ id: b.id, startsAt: b.startsAt, endsAt: b.endsAt, summary: `Viewing: ${lead}`, description: `Lead ${ref}${phone ? `, ${phone}` : ""}. Booked by ${b.bookedBy}.`, location: b.location, status: b.status, updatedAt: b.updatedAt })));
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=300" } });
});
