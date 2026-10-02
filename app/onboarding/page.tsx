import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/marketing/site-chrome";
import { OnboardingWizard } from "@/components/marketing/onboarding-wizard";
import { clerkEnabled, getAuthState } from "@/lib/auth";
import { PLANS, type PlanId } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create your workspace" };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const { plan } = await searchParams;
  const state = await getAuthState();
  if (clerkEnabled) {
    if (state.status === "signed_out") redirect("/sign-up");
    if (state.status === "ok") redirect("/home");
  }
  const defaultPlan: PlanId = PLANS.some((p) => p.id === plan) ? (plan as PlanId) : "professional";
  const name = state.status === "needs_onboarding" ? state.name : "";
  const email = state.status === "needs_onboarding" ? state.email : "";
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 pt-8 pb-24 md:px-12 xl:px-20">
        <div className="max-w-[640px]">
          <div className="eyebrow">New workspace</div>
          <h1 className="mt-4 font-display text-title text-navy-900">Set up your firm on Nakhla</h1>
          <p className="mt-3 text-body text-ink-700">Five short steps. Your workspace is private to your firm from the first moment, and you can change everything later in Administration.</p>
        </div>
        <div className="mt-10">
          <OnboardingWizard askAdmin={!clerkEnabled} defaultName={name} defaultEmail={email} defaultPlan={defaultPlan} />
        </div>
      </main>
    </div>
  );
}
