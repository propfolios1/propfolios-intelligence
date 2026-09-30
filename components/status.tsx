import { Pill } from "./ui/pill";
import type { MandateStatus, Recommendation, RiskRating, Severity } from "@/lib/data/types";
import { STAGE_LABEL } from "@/lib/data/types";

const STATUS_TONE: Record<MandateStatus, "neutral" | "navy" | "gold" | "positive" | "warning"> = {
  intake: "neutral",
  research: "navy",
  underwriting: "navy",
  dd: "navy",
  debate: "navy",
  memo: "navy",
  review: "warning",
  delivered: "positive",
};

export const STATUS_DOT: Record<MandateStatus, string> = {
  intake: "bg-ink-400",
  research: "bg-navy-300",
  underwriting: "bg-navy-400",
  dd: "bg-navy-500",
  debate: "bg-navy-600",
  memo: "bg-navy-800",
  review: "bg-warning",
  delivered: "bg-positive",
};

export function StatusPill({ status }: { status: MandateStatus }) {
  return (
    <Pill tone={STATUS_TONE[status]} dot>
      {STAGE_LABEL[status]}
    </Pill>
  );
}

const SEVERITY_TONE: Record<Severity, "negative" | "warning" | "navy" | "neutral"> = {
  critical: "negative",
  high: "warning",
  medium: "navy",
  low: "neutral",
};

export function SeverityPill({ severity }: { severity: Severity }) {
  return (
    <Pill tone={SEVERITY_TONE[severity]} className="capitalize">
      {severity}
    </Pill>
  );
}

export function RecommendationPill({ value }: { value: Recommendation }) {
  return <Pill tone={value === "Proceed" ? "positive" : value === "Decline" ? "negative" : "warning"}>{value}</Pill>;
}

export function RiskPill({ value }: { value: RiskRating }) {
  return <Pill tone={value === "Low" ? "positive" : value === "Moderate" ? "navy" : value === "Elevated" ? "warning" : "negative"}>{value} risk</Pill>;
}
