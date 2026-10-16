import { ArrowRight, BookOpen, CheckCircle2, FileSignature, Flag, Receipt, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { NextStep, StepKind } from "@/lib/client/next-steps";
import { cn, formatDate } from "@/lib/utils";
import { TONE } from "./tiles";

const ICON: Record<StepKind, LucideIcon> = { kyc: ShieldCheck, contract: FileSignature, invoice: Receipt, report: BookOpen, recommendation: Sparkles, goal: Flag };

/** The client's to-do list, most urgent first. When nothing is outstanding it says so plainly. */
export function NextSteps({ steps, limit = 5 }: { steps: NextStep[]; limit?: number }) {
  if (!steps.length) {
    return (
      <div className="flex items-center gap-4 rounded-lg border border-mint-100 bg-linear-to-br from-mint-50 to-surface p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-mint-100 text-mint-700">
          <CheckCircle2 className="size-5 stroke-[1.75]" aria-hidden />
        </span>
        <div>
          <p className="text-ui font-semibold text-ink-900">Nothing needs your attention</p>
          <p className="mt-0.5 text-meta text-ink-500">Verification is current, every contract is signed and every invoice is settled.</p>
        </div>
      </div>
    );
  }
  const shown = steps.slice(0, limit);
  return (
    <ol className="space-y-2">
      {shown.map((s) => {
        const Icon = ICON[s.kind];
        const t = TONE[s.tone];
        return (
          <li key={s.id}>
            <Link href={s.href} className="group flex items-center gap-4 rounded-lg border border-hairline bg-surface p-4 transition-[border-color,box-shadow] duration-150 hover:border-ink-200 hover:shadow-float">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", t.tile)}>
                <Icon className="size-[18px] stroke-[1.75]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-ui font-semibold text-ink-900">{s.title}</span>
                  {s.due && <span className={cn("num text-axis", t.ink)}>{formatDate(s.due)}</span>}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-meta text-ink-500">{s.detail}</span>
              </span>
              <span className={cn("hidden shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-meta font-medium transition-[gap] duration-150 group-hover:gap-2 sm:inline-flex", t.tile)}>
                {s.cta}
                <ArrowRight className="size-3.5" aria-hidden />
              </span>
            </Link>
          </li>
        );
      })}
      {steps.length > limit && <li className="px-1 pt-1 text-meta text-ink-500">{steps.length - limit} more in your documents, contracts and reports.</li>}
    </ol>
  );
}
