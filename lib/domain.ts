/** Client-safe domain constants shared by components and pages. */

export const MANDATE_STAGES = ["INTAKE", "RESEARCH", "UNDERWRITING", "DUE_DILIGENCE", "DEBATE", "MEMO", "REVIEW", "DELIVERED"] as const;
export type MandateStage = (typeof MANDATE_STAGES)[number];

export const STAGE_LABEL: Record<MandateStage, string> = {
  INTAKE: "Intake",
  RESEARCH: "Research",
  UNDERWRITING: "Underwriting",
  DUE_DILIGENCE: "Due diligence",
  DEBATE: "Debate",
  MEMO: "Memo",
  REVIEW: "Review",
  DELIVERED: "Delivered",
};

export const STAGE_AGENT_LABEL: Record<MandateStage, string> = {
  INTAKE: "Intake checks",
  RESEARCH: "Research agent",
  UNDERWRITING: "Underwriting agent and financial engine",
  DUE_DILIGENCE: "Due diligence agent",
  DEBATE: "Bull, bear and judge agents",
  MEMO: "Memo agent",
  REVIEW: "Investment committee review",
  DELIVERED: "Delivered to client",
};

export const AUTOMATED_STAGES: MandateStage[] = ["INTAKE", "RESEARCH", "UNDERWRITING", "DUE_DILIGENCE", "DEBATE", "MEMO"];

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export const SEVERITY_ORDER: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export type StageRun = { stage: string; agent: string; status: "pending" | "running" | "complete" | "failed"; startedAt?: string; completedAt?: string; costUsd?: number; durationMs?: number; model?: string };

export const MEMO_STATUS_LABEL: Record<string, string> = { draft: "Draft", in_review: "In review", approved: "Approved", delivered: "Delivered" };

export const PROPERTY_STATUS_LABEL: Record<string, string> = { off_plan: "Off-plan", under_construction: "Under construction", ready: "Ready" };

export const DOC_TYPE_LABEL: Record<string, string> = {
  memo: "Memo",
  spa: "SPA",
  title_deed: "Title deed",
  valuation: "Valuation",
  statement: "Statement",
  research: "Research",
  kyc: "KYC",
  other: "Document",
};

export const REC_TYPE_LABEL: Record<string, string> = {
  exit_window: "Exit window",
  new_opportunity: "New opportunity",
  rebalance: "Rebalance",
  refinance: "Refinance",
  risk: "Risk",
};

/** Local currency value with sensible unit. INR in crore. */
export function formatLocal(value: number, currency: string) {
  if (currency === "INR") return `INR ${(value / 10_000_000).toFixed(2)} Cr`;
  if (Math.abs(value) >= 1_000_000_000) return `${currency} ${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `${currency} ${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `${currency} ${Math.round(value / 1_000)}K`;
  return `${currency} ${Math.round(value)}`;
}

export function formatAed(value: number) {
  return formatLocal(value, "AED");
}
