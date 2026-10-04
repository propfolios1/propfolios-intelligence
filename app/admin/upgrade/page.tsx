import Link from "next/link";
import { PageHeader } from "@/components/composites/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { UpgradePlans } from "@/components/trial/upgrade";
import { getDb } from "@/db";
import { requireRole } from "@/lib/auth";
import { ANNUAL_DISCOUNT, stripeConfigured } from "@/lib/billing/stripe";
import { planById } from "@/lib/plans";
import { getTenantById } from "@/lib/tenant";
import { trialStatus } from "@/lib/trial/status";

export const metadata = { title: "Upgrade" };
export const dynamic = "force-dynamic";

export default async function UpgradePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireRole(["tenant_admin"]);
  const { status } = await searchParams;
  const [t, tenant] = await Promise.all([trialStatus(await getDb(), user.tenantId), getTenantById(user.tenantId)]);
  const card = (id: "starter" | "professional") => {
    const p = planById(id);
    return { id, name: p.name, monthly: p.priceAed, annualMonthly: Math.round(p.priceAed * (1 - ANNUAL_DISCOUNT)), seats: p.seats ? `Up to ${p.seats} agents` : "Unlimited agents", features: p.features.slice(0, 5) };
  };
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Administration"
        title="Upgrade"
        subtitle={t ? (t.state === "read_only" ? "The trial has ended and the workspace is read-only. Upgrading restores full access immediately, in the same workspace." : `${t.daysRemaining} days remain in the trial. Upgrading keeps every record, user and connection in place.`) : `${tenant?.name ?? "The workspace"} is on the ${planById(tenant?.plan ?? "starter").name} plan.`}
      />
      {status === "success" && <p role="status" className="mt-6 rounded-sm border border-success/30 bg-success/5 px-4 py-3 text-ui text-ink-900">Payment received. The plan updates as soon as Stripe confirms it, usually within a minute.</p>}
      {status === "cancelled" && <p role="status" className="mt-6 rounded-sm bg-ink-50 px-4 py-3 text-ui text-ink-700">Checkout was cancelled; nothing was charged.</p>}
      {!stripeConfigured() && <p className="mt-6 rounded-sm bg-ink-50 px-4 py-3 text-ui text-ink-700">Card payment is not configured on this deployment. Contact Nakhla to upgrade by invoice; support converts the workspace in place.</p>}
      <section className="mt-10">
        <UpgradePlans configured={stripeConfigured()} plans={[card("starter"), card("professional")]} />
      </section>
      <section className="mt-10 rounded-md border border-hairline bg-surface p-6">
        <h2 className="text-[16px] font-medium text-navy-900">Enterprise and White-label</h2>
        <p className="mt-2 max-w-[72ch] text-ui text-ink-700">Unlimited agents, single sign-on, data residency and custom domains are contracted with the Nakhla team, with an AED invoice and a data processing agreement.</p>
        <Link href="/pricing" className="mt-4 inline-block text-ui font-medium text-navy-900 underline underline-offset-4">
          Compare plans
        </Link>
      </section>
    </PageContainer>
  );
}
