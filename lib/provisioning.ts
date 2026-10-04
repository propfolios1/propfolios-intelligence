import "server-only";
import { eq, like } from "drizzle-orm";
import { getDb } from "@/db";
import * as s from "@/db/schema";
import { seedTenantData } from "@/db/seed";
import { clerkEnabled, HttpError } from "./auth";
import { planById, type PlanId } from "./plans";
import { defaultTenantConfig, slugify } from "./tenant";

export interface ProvisionInput {
  name: string;
  brand: Partial<Pick<s.TenantConfig, "brand_name" | "logo_url" | "primary_color" | "accent_color" | "font_display" | "custom_domain">>;
  plan: PlanId;
  status?: "trial" | "active";
  admin: { name: string; email: string; clerkUserId?: string | null };
  invites: { email: string; role: "tenant_admin" | "analyst" }[];
  seedDemo: boolean;
  /** Who is provisioning, for the audit log. */
  actor: string;
}

const RESERVED = new Set(["nakhla", "platform", "admin", "api", "www", "app"]);

async function uniqueSlug(base: string) {
  const db = await getDb();
  const root = slugify(base) || "firm";
  const taken = new Set((await db.select({ slug: s.tenants.slug }).from(s.tenants).where(like(s.tenants.slug, `${root}%`))).map((r) => r.slug));
  if (!taken.has(root) && !RESERVED.has(root)) return root;
  for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
}

/**
 * Creates a tenant end to end: tenant row with branding, Clerk organisation
 * and invitations (when Clerk is configured), administrator and invited staff,
 * a 14-day trial subscription, optional demonstration data, and audit entries.
 * Enforces the plan's seat limit and white-label domain rights.
 */
export async function provisionTenant(input: ProvisionInput) {
  const db = await getDb();
  const plan = planById(input.plan);
  const invites = input.invites.filter((i) => i.email.toLowerCase() !== input.admin.email.toLowerCase());
  const staffCount = 1 + invites.length;
  if (plan.seats !== null && staffCount > plan.seats) throw new HttpError(402, `The ${plan.name} plan includes ${plan.seats} staff seats; you invited ${staffCount}. Choose a larger plan or invite fewer people.`);
  const domain = input.brand.custom_domain?.trim().toLowerCase() || null;
  if (domain && !plan.customDomain) throw new HttpError(402, "Custom domains are part of the White-label plan.");
  if (domain) {
    const [clash] = await db.select({ id: s.tenants.id }).from(s.tenants).where(eq(s.tenants.customDomain, domain));
    if (clash) throw new HttpError(409, `${domain} is already connected to another workspace.`);
  }

  const slug = await uniqueSlug(input.name);
  const brandName = input.brand.brand_name?.trim() || input.name;
  const config = defaultTenantConfig(brandName, {
    logo_url: input.brand.logo_url || null,
    primary_color: input.brand.primary_color || "#0A1F44",
    accent_color: input.brand.accent_color || "#C9A961",
    font_display: input.brand.font_display ?? "Playfair Display",
    custom_domain: domain,
  });

  let clerkOrgId: string | null = null;
  if (clerkEnabled) {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const clerk = await clerkClient();
    const org = await clerk.organizations.createOrganization({ name: input.name, slug, createdBy: input.admin.clerkUserId ?? undefined });
    clerkOrgId = org.id;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    for (const inv of [...(input.admin.clerkUserId ? [] : [{ email: input.admin.email, role: "tenant_admin" as const }]), ...invites]) {
      await clerk.organizations.createOrganizationInvitation({
        organizationId: org.id,
        emailAddress: inv.email,
        role: inv.role === "tenant_admin" ? "org:admin" : "org:member",
        inviterUserId: input.admin.clerkUserId ?? undefined,
        redirectUrl: appUrl ? `${appUrl}/sign-up` : undefined,
      });
    }
  }

  const [tenant] = await db
    .insert(s.tenants)
    .values({ name: input.name, slug, clerkOrgId, configJson: config, plan: plan.id, status: input.status ?? "trial", customDomain: domain })
    .returning();
  const tenantId = tenant!.id;
  const now = Date.now();
  await db.insert(s.subscriptions).values({
    tenantId,
    plan: plan.id,
    status: input.status === "active" ? "active" : "trialing",
    seats: plan.seats,
    priceAed: plan.priceAed,
    currentPeriodEnd: new Date(now + (input.status === "active" ? 30 : 14) * 86_400_000),
  });
  const [admin] = await db
    .insert(s.users)
    .values({
      tenantId,
      email: input.admin.email.toLowerCase(),
      name: input.admin.name,
      title: "Administrator",
      role: "tenant_admin",
      clerkUserId: input.admin.clerkUserId ?? null,
      invitedAt: input.admin.clerkUserId ? null : new Date(),
      lastActiveAt: input.admin.clerkUserId ? new Date() : null,
      preferences: { digest: "weekly", alerts: true, currency: "AED" },
    })
    .returning();
  if (invites.length) {
    await db.insert(s.users).values(invites.map((i) => ({ tenantId, email: i.email.toLowerCase(), name: i.email.split("@")[0]!.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), role: i.role, invitedAt: new Date() })));
  }
  await db.insert(s.auditLogs).values([
    { tenantId, actorName: input.actor, actorType: "user", action: `created workspace on the ${plan.name} plan` },
    ...invites.map((i) => ({ tenantId, actorName: input.actor, actorType: "user" as const, action: `invited ${i.email} as ${i.role === "tenant_admin" ? "administrator" : "analyst"}` })),
  ]);
  if (input.seedDemo) await seedTenantData(db, { tenantId, slug, key: slug, staff: false, adminUserId: admin!.id, adminName: admin!.name });
  return { tenant: tenant!, adminUserId: admin!.id };
}
