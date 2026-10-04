import { createHmac, timingSafeEqual } from "node:crypto";
import { request } from "@/lib/integrations/http";
import { planById, type PlanId, VAT_RATE } from "@/lib/plans";

/**
 * Stripe Checkout over the REST API (no SDK). Plans are priced in AED with
 * inline price data, so no products need to be created in Stripe first;
 * annual billing is twelve months less 20%. The webhook signature is
 * verified per Stripe's scheme: HMAC-SHA256 of "timestamp.payload" with the
 * endpoint secret, within a five-minute tolerance.
 */

export const ANNUAL_DISCOUNT = 0.2;
export const stripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);

export function planCharge(planId: PlanId, interval: "month" | "year") {
  const p = planById(planId);
  const net = interval === "year" ? Math.round(p.priceAed * 12 * (1 - ANNUAL_DISCOUNT)) : p.priceAed;
  return { plan: p, net, vat: Math.round(net * VAT_RATE * 100) / 100, total: Math.round(net * (1 + VAT_RATE) * 100) / 100 };
}

export async function createCheckoutSession(i: { tenantId: string; plan: PlanId; interval: "month" | "year"; email: string; successUrl: string; cancelUrl: string }) {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not configured: set STRIPE_SECRET_KEY.");
  const c = planCharge(i.plan, i.interval);
  const form: Record<string, string> = {
    mode: "subscription",
    customer_email: i.email,
    success_url: i.successUrl,
    cancel_url: i.cancelUrl,
    client_reference_id: i.tenantId,
    "metadata[tenant_id]": i.tenantId,
    "metadata[plan]": i.plan,
    "subscription_data[metadata][tenant_id]": i.tenantId,
    "subscription_data[metadata][plan]": i.plan,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "aed",
    "line_items[0][price_data][unit_amount]": String(Math.round(c.total * 100)),
    "line_items[0][price_data][recurring][interval]": i.interval,
    "line_items[0][price_data][product_data][name]": `Nakhla ${c.plan.name}, ${i.interval === "year" ? "annual" : "monthly"} (including 5% VAT)`,
  };
  return request<{ id: string; url: string }>("Stripe", "https://api.stripe.com/v1/checkout/sessions", { method: "POST", form, headers: { authorization: `Bearer ${key}` }, retries: 1 });
}

export function verifyStripeSignature(payload: string, header: string | null, secret: string, toleranceSec = 300, now = Date.now()) {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  const v1 = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  if (!t || !v1.length || Math.abs(now / 1000 - t) > toleranceSec) return false;
  const want = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return v1.some((sig) => sig.length === want.length && timingSafeEqual(Buffer.from(sig), Buffer.from(want)));
}
