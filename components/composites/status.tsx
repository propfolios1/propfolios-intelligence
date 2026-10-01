import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { MEMO_STATUS_LABEL, STAGE_LABEL, type MandateStage, type Severity } from "@/lib/domain";
import { cn } from "@/lib/utils";

const STAGE_TONE: Record<MandateStage, PillTone> = {
  INTAKE: "neutral",
  RESEARCH: "progress",
  UNDERWRITING: "progress",
  DUE_DILIGENCE: "progress",
  DEBATE: "progress",
  MEMO: "progress",
  REVIEW: "progress",
  DELIVERED: "complete",
};

export function StagePill({ status }: { status: string }) {
  const s = status as MandateStage;
  return <StatusPill tone={STAGE_TONE[s] ?? "neutral"}>{STAGE_LABEL[s] ?? status}</StatusPill>;
}

const SEVERITY_CLASS: Record<Severity, string> = {
  CRITICAL: "bg-danger text-surface",
  HIGH: "bg-danger-soft text-danger",
  MEDIUM: "bg-warning-soft text-warning",
  LOW: "bg-ink-100 text-ink-700",
};

/** Severity: critical is the only filled badge in the product. */
export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const s = severity.toUpperCase() as Severity;
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center rounded-xs px-1.5 text-eyebrow font-medium tracking-[0.06em] uppercase", SEVERITY_CLASS[s] ?? SEVERITY_CLASS.LOW, className)}>
      {s.toLowerCase()}
    </span>
  );
}

export function RecommendationPill({ value }: { value: string | null }) {
  if (!value) return <span className="text-small text-ink-500">Pending</span>;
  return <StatusPill tone={value === "Proceed" ? "complete" : value === "Decline" ? "error" : "progress"}>{value}</StatusPill>;
}

export function RiskPill({ value }: { value: string | null }) {
  if (!value) return <span className="text-small text-ink-500">Not rated</span>;
  return <StatusPill tone={value === "High" ? "error" : value === "Elevated" ? "progress" : "neutral"}>{value} risk</StatusPill>;
}

export function MemoStatusPill({ status }: { status: string }) {
  return <StatusPill tone={status === "delivered" || status === "approved" ? "complete" : status === "in_review" ? "progress" : "neutral"}>{MEMO_STATUS_LABEL[status] ?? status}</StatusPill>;
}
