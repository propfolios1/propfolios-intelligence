import { NextResponse } from "next/server";
import { z } from "zod";
import { audit, handle, parseBody } from "@/lib/api";
import { HttpError, requireApiUser } from "@/lib/auth";
import { createCheckoutSession, stripeConfigured } from "@/lib/billing/stripe";
import { appOrigin } from "@/lib/integrations/origin";

const body = z.object({ plan: z.enum(["starter", "professional"]), interval: z.enum(["month", "year"]) });

/** Self-serve upgrade: Starter and Professional through Stripe Checkout. Enterprise and White-label are contracted with sales. */
export const POST = handle(async (req: Request) => {
  const user = await requireApiUser(["tenant_admin"]);
  const b = await parseBody(req, body);
  if (!stripeConfigured()) throw new HttpError(503, "Card payment is not configured on this deployment (STRIPE_SECRET_KEY). Contact Nakhla to upgrade by invoice.");
  const origin = appOrigin(req);
  const session = await createCheckoutSession({ tenantId: user.tenantId, plan: b.plan, interval: b.interval, email: user.email, successUrl: `${origin}/admin/upgrade?status=success`, cancelUrl: `${origin}/admin/upgrade?status=cancelled` });
  await audit(user, `opened checkout for the ${b.plan} plan (${b.interval === "year" ? "annual" : "monthly"})`);
  return NextResponse.json({ url: session.url });
});
