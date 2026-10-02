import { NextResponse } from "next/server";
import { audit, handle, parseBody } from "@/lib/api";
import { clerkEnabled, getAuthState, HttpError } from "@/lib/auth";
import { provisionTenant } from "@/lib/provisioning";
import { enforceRateLimit } from "@/lib/rate-limit";
import { provisionInput } from "@/lib/tenant-schemas";

export const maxDuration = 120;

/**
 * Self-serve onboarding: creates the caller's workspace on a 14-day trial.
 * With Clerk, the signed-in user becomes its administrator and a Clerk
 * organisation is created; in demonstration mode the administrator named in
 * the form is created and the browser switches to that account.
 */
export const POST = handle(async (req: Request) => {
  const state = await getAuthState();
  const input = await parseBody(req, provisionInput);
  if (clerkEnabled) {
    if (state.status === "signed_out") throw new HttpError(401, "Create an account first.");
    if (state.status === "ok") throw new HttpError(409, "Your account already belongs to a workspace.");
  } else if (!input.admin) {
    throw new HttpError(422, "Enter the administrator's name and email.");
  }
  let clerkUserId: string | null = null;
  if (clerkEnabled) {
    const { auth } = await import("@clerk/nextjs/server");
    clerkUserId = (await auth()).userId;
  }
  const admin =
    clerkEnabled && state.status === "needs_onboarding" ? { name: input.admin?.name ?? state.name, email: state.email, clerkUserId } : { name: input.admin!.name, email: input.admin!.email, clerkUserId: null };
  await enforceRateLimit({ id: admin.email, tenantId: "onboarding" }, "write");
  const { tenant, adminUserId } = await provisionTenant({ name: input.name, brand: input.brand, plan: input.plan, admin, invites: input.invites, seedDemo: input.seedDemo, actor: admin.name });
  await audit({ tenantId: tenant.id, name: admin.name, id: adminUserId }, "completed onboarding");
  const redirect = clerkEnabled ? "/admin/dashboard" : `/api/demo/persona?user=${adminUserId}&to=/admin/dashboard`;
  return NextResponse.json({ tenantId: tenant.id, slug: tenant.slug, adminUserId, redirect }, { status: 201 });
});
