import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import type { MandateStatus, Recommendation, RiskRating, Severity } from "@/lib/data/types";
import { STAGE_LABEL } from "@/lib/data/types";

const STATUS_TONE: Record<MandateStatus, PillTone> = {
  intake: "neutral",
  research: "progress",
  underwriting: "progress",
  dd: "progress",
  debate: "progress",
  memo: "progress",
  review: "progress",
  delivered: "complete",
};

export function StatusPillFor({ status }: { status: MandateStatus }) {
  return <StatusPill tone={STATUS_TONE[status]}>{STAGE_LABEL[status]}</StatusPill>;
}

const SEVERITY_TONE: Record<Severity, PillTone> = { critical: "error", high: "progress", medium: "neutral", low: "neutral" };

export function SeverityPill({ severity }: { severity: Severity }) {
  return <StatusPill tone={SEVERITY_TONE[severity]}>{severity}</StatusPill>;
}

export function RecommendationPill({ value }: { value: Recommendation }) {
  return <StatusPill tone={value === "Proceed" ? "complete" : value === "Decline" ? "error" : "progress"}>{value}</StatusPill>;
}

export function RiskPill({ value }: { value: RiskRating }) {
  return <StatusPill tone={value === "High" ? "error" : value === "Elevated" ? "progress" : "neutral"}>{value} risk</StatusPill>;
}
