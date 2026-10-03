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

const SEVERITY_TONE: Record<Severity, PillTone> = { CRITICAL: "error", HIGH: "error", MEDIUM: "progress", LOW: "neutral" };

/** Severity: neutral pill, the dot carries the level; critical adds a red outline. */
export function SeverityBadge({ severity, className }: { severity: string; className?: string }) {
  const s = severity.toUpperCase() as Severity;
  return (
    <StatusPill tone={SEVERITY_TONE[s] ?? "neutral"} className={cn(s === "CRITICAL" && "border-danger/40 text-danger", className)}>
      {s.toLowerCase()}
    </StatusPill>
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
