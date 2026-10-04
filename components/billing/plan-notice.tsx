import Link from "next/link";
import { MODULE_LABEL, MODULE_MIN_PLAN, planById, planIncludes, type PlanModule } from "@/lib/plans";

/** Shown on a module the firm's plan does not include; reading stays open, changes are refused by the API. */
export function PlanNotice({ plan, module }: { plan: string; module: PlanModule }) {
  if (planIncludes(plan, module)) return null;
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-hairline border-l-2 border-l-gold-500 bg-surface px-4 py-3">
      <p className="text-small text-ink-700">
        {MODULE_LABEL[module]} is included from the {planById(MODULE_MIN_PLAN[module]).name} plan. You can explore it here; saving and sending are available after upgrading.
      </p>
      <Link href="/admin/upgrade" className="text-ui font-medium text-navy-900 underline decoration-ink-200 underline-offset-4">
        Compare plans
      </Link>
    </div>
  );
}
