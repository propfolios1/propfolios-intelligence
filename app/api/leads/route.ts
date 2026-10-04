import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { audit, handle, parseBody } from "@/lib/api";
import { requireApiUser, requirePermission } from "@/lib/auth";
import { createLead, listLeads } from "@/lib/brokerage/leads";
import { LEAD_SOURCES, MARKET_CODES } from "@/lib/markets";
import { enforceRateLimit } from "@/lib/rate-limit";

export const GET = handle(async () => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  const rows = await listLeads(await getDb(), user.tenantId);
  return NextResponse.json({ leads: rows.map((r) => ({ ...r.lead, owner: r.owner, listing: r.listing })) });
});

const body = z.object({
  name: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(200).nullable().optional(),
  phone: z.string().trim().min(6).max(40).nullable().optional(),
  source: z.enum(LEAD_SOURCES.map((s) => s.key) as [string, ...string[]]),
  market: z.enum(MARKET_CODES),
  intent: z.enum(["buy", "rent", "sell", "let", "invest"]),
  timeline: z.enum(["immediate", "3_months", "6_months", "12_months", "exploring"]).optional(),
  budgetMax: z.number().positive().nullable().optional(),
  listingId: z.string().uuid().nullable().optional(),
  message: z.string().max(2000).nullable().optional(),
  consentMarketing: z.boolean().optional(),
});

/** Records a lead taken by phone, walk-in or WhatsApp; portal leads arrive through /api/leads/inbound. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin", "analyst"]);
  requirePermission(user, "leads:manage");
  await enforceRateLimit(user, "write");
  const b = await parseBody(req, body);
  const lead = await createLead(await getDb(), user.tenantId, b, { id: user.id, name: user.name });
  await audit(user, "created lead", { entityType: "lead", entityId: lead.id, after: lead });
  return NextResponse.json({ id: lead.id, reference: lead.reference }, { status: 201 });
});
