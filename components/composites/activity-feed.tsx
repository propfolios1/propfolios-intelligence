import { Bot, Cog, User } from "lucide-react";
import Link from "next/link";
import { RelativeTime } from "@/components/ui/relative-time";
import { cn } from "@/lib/utils";

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

const ICON = { agent: Bot, user: User, system: Cog } as const;

/** Activity rows: 40px, a 16px line icon, actor in 14px 500, action in 14px ink-700, relative time in 12px mono ink-400. */
export function ActivityFeed({ items, linkMandates = true, className }: { items: ActivityItem[]; linkMandates?: boolean; className?: string }) {
  if (!items.length) return <p className={cn("py-6 text-ui text-ink-500", className)}>No activity in this workspace yet. Agent runs, approvals and edits appear here as they happen.</p>;
  return (
    <ul className={cn("divide-y divide-hairline-row", className)}>
      {items.map((a) => {
        const Icon = ICON[a.actorType];
        const meta = a.actorType === "agent" && (a.model || a.costUsd) ? [a.model === "replay" ? "replay" : a.model, a.costUsd ? `$${a.costUsd.toFixed(3)}` : null].filter(Boolean).join(" · ") : null;
        return (
          <li key={a.id} className="flex h-10 items-center gap-3">
            <Icon className="size-4 shrink-0 stroke-[1.5] text-ink-400" aria-hidden />
            <div className="min-w-0 flex-1 truncate text-ui" title={meta ?? undefined}>
              <span className="font-medium text-ink-900">{a.actorName}</span> <span className="text-ink-700">{a.action}</span>
              {a.reference &&
                !a.action.includes(a.reference) &&
                (linkMandates && a.mandateId ? (
                  <Link href={`/analyst/mandates/${a.mandateId}`} className="num ms-1.5 text-mono text-ink-500 hover:text-ink-900">
                    {a.reference}
                  </Link>
                ) : (
                  <span className="num ms-1.5 text-mono text-ink-500">{a.reference}</span>
                ))}
            </div>
            {meta && <span className="num hidden shrink-0 text-axis text-ink-400 xl:inline">{meta}</span>}
            <time className="num shrink-0 text-axis text-ink-400" dateTime={new Date(a.createdAt).toISOString()}>
              <RelativeTime iso={new Date(a.createdAt).toISOString()} />
            </time>
          </li>
        );
      })}
    </ul>
  );
}
