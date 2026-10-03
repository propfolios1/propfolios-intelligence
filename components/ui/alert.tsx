import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  info: { rule: "border-l-navy-700", icon: Info, iconClass: "text-navy-700" },
  warning: { rule: "border-l-warning", icon: AlertTriangle, iconClass: "text-warning" },
  danger: { rule: "border-l-danger", icon: OctagonAlert, iconClass: "text-danger" },
} as const;

export function Alert({ tone = "info", title, children, action, className }: { tone?: keyof typeof TONE; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const t = TONE[tone];
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cn("flex gap-3 rounded-md border border-l-2 border-hairline bg-surface px-4 py-3", t.rule, className)}>
      <t.icon className={cn("mt-0.5 size-4 shrink-0", t.iconClass)} />
      <div className="min-w-0 flex-1">
        <p className="text-ui font-medium text-ink-900">{title}</p>
        {children && <div className="mt-1 text-ui text-ink-700">{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
