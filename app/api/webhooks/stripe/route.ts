import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { verifyStripeSignature } from "@/lib/billing/stripe";
import type { PlanId } from "@/lib/plans";
import { convertTrial } from "@/lib/trial/service";

/** Stripe events. checkout.session.completed converts the paying workspace in place. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const payload = await req.text();
  if (!secret || !verifyStripeSignature(payload, req.headers.get("stripe-signature"), secret)) return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  const event = JSON.parse(payload) as { type: string; data: { object: { id: string; metadata?: Record<string, string>; client_reference_id?: string } } };
  if (event.type === "checkout.session.completed") {
    const o = event.data.object;
    const tenantId = o.metadata?.tenant_id ?? o.client_reference_id;
    const plan = (o.metadata?.plan ?? "professional") as PlanId;
    if (tenantId) await convertTrial(await getDb(), tenantId, plan, "Stripe Checkout", o.id);
  }
  return NextResponse.json({ received: true });
}
