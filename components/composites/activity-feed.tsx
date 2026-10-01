import Link from "next/link";
import { cn, relativeTime } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  actorName: string;
  actorType: "user" | "agent" | "system";
  action: string;
  createdAt: Date | string;
  reference?: string | null;
  mandateId?: string | null;
  costUsd?: number | null;
  model?: string | null;
}

/** Chronological agent and human activity. Agent rows carry model and cost. */
export function ActivityFeed({ items, linkMandates = true, className }: { items: ActivityItem[]; linkMandates?: boolean; className?: string }) {
  if (!items.length) return <p className={cn("py-6 text-small text-ink-500", className)}>No activity yet.</p>;
  return (
    <ul className={cn("divide-y divide-ink-200", className)}>
      {items.map((a) => (
        <li key={a.id} className="grid grid-cols-[8px_1fr_auto] items-baseline gap-3 py-3">
          <span className={cn("size-1.5 translate-y-[-1px] rounded-full", a.actorType === "agent" ? "bg-gold-500" : a.actorType === "user" ? "bg-navy-900" : "bg-ink-400")} aria-hidden />
          <div className="min-w-0 text-small">
            <span className="font-medium text-ink-900">{a.actorName}</span> <span className="text-ink-700">{a.action}</span>
            {a.reference && !a.action.includes(a.reference) &&
              (linkMandates && a.mandateId ? (
                <Link href={`/analyst/mandates/${a.mandateId}`} className="num ml-1.5 text-ink-500 underline decoration-ink-200 underline-offset-2 hover:text-ink-900">
                  {a.reference}
                </Link>
              ) : (
                <span className="num ml-1.5 text-ink-500">{a.reference}</span>
              ))}
            {a.actorType === "agent" && (a.model || a.costUsd) ? (
              <div className="num mt-0.5 text-axis text-ink-500">
                {[a.model === "replay" ? "replay mode" : a.model, a.costUsd ? `$${a.costUsd.toFixed(4)}` : null].filter(Boolean).join(" · ")}
              </div>
            ) : null}
          </div>
          <time className="num shrink-0 text-axis text-ink-500" dateTime={new Date(a.createdAt).toISOString()}>
            {relativeTime(new Date(a.createdAt).toISOString())}
          </time>
        </li>
      ))}
    </ul>
  );
}
