import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { sendEmail } from "@/lib/os/notify";
import { PLANS } from "@/lib/plans";
import { enforcePublicRateLimit } from "@/lib/rate-limit";

const body = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  firm: z.string().trim().min(2).max(160),
  market: z.enum(["UAE", "India", "Both"]),
  plan: z.enum(PLANS.map((p) => p.id) as [string, ...string[]]),
  note: z.string().trim().max(1000).optional().default(""),
});

/**
 * Public access request from the landing page. Recorded against the platform
 * workspace: the request lands in the platform email outbox (sent through
 * Resend when configured) and in the platform audit log.
 */
export const POST = handle(async (req: Request) => {
  await enforcePublicRateLimit(req, "sign");
  const b = await parseBody(req, body);
  const db = await getDb();
  const tenants = await db.select({ id: s.tenants.id, cfg: s.tenants.configJson }).from(s.tenants);
  const platform = tenants.find((t) => t.cfg.platform);
  if (!platform) throw new HttpError(503, "Access requests are not open on this deployment yet. Write to the platform team directly.");
  const [admin] = await db.select({ email: s.users.email }).from(s.users).where(and(eq(s.users.tenantId, platform.id), eq(s.users.role, "platform_admin"))).limit(1);
  const to = process.env.ACCESS_REQUEST_EMAIL || admin?.email;
  if (!to) throw new HttpError(503, "Access requests are not open on this deployment yet. Write to the platform team directly.");
  const plan = PLANS.find((p) => p.id === b.plan)!;
  const mail = await sendEmail(db, {
    tenantId: platform.id,
    to,
    subject: `Access request: ${b.firm} (${plan.name})`,
    text: [`Name: ${b.name}`, `Email: ${b.email}`, `Firm: ${b.firm}`, `Market: ${b.market}`, `Plan: ${plan.name}, AED ${plan.priceAed.toLocaleString("en-US")} per month`, "", b.note || "No note."].join("\n"),
  });
  await audit({ tenantId: platform.id, name: b.name }, "Access requested", { entityType: "tenant", detail: { firm: b.firm, market: b.market, plan: b.plan, email: b.email } });
  return NextResponse.json({ ok: true, delivered: mail.status === "sent" }, { status: 201 });
});
