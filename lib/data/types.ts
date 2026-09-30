export const MANDATE_STAGES = [
  "intake",
  "research",
  "underwriting",
  "dd",
  "debate",
  "memo",
  "review",
  "delivered",
] as const;
export type MandateStatus = (typeof MANDATE_STAGES)[number];

export const STAGE_LABEL: Record<MandateStatus, string> = {
  intake: "Intake",
  research: "Research",
  underwriting: "Underwriting",
  dd: "DD",
  debate: "Debate",
  memo: "Memo",
  review: "Review",
  delivered: "Delivered",
};

export type Market = "UAE" | "India";
export type AssetClass = "Residential" | "Branded Residence" | "Office" | "Retail" | "Hospitality" | "Logistics";
export type Severity = "critical" | "high" | "medium" | "low";
export type Recommendation = "Proceed" | "Proceed with conditions" | "Decline";
export type RiskRating = "Low" | "Moderate" | "Elevated" | "High";

export interface Client {
  id: string;
  name: string;
  type: "Family Office" | "HNWI" | "Private Bank" | "Endowment";
  domicile: string;
  aumUsd: number;
  relationshipLead: string;
}

export interface Developer {
  id: string;
  name: string;
  market: Market;
  hq: string;
  riskScore: number; // 0 (safe) – 100 (risky)
  deliveryPct: number; // % of projects delivered on time
  litigationCount: number;
  projectsDelivered: number;
  escrowCompliant: boolean;
  updatedAt: string;
  brandColor: string;
}

export interface Property {
  id: string;
  name: string;
  developerId: string;
  market: Market;
  region: string; // Emirate or Indian state/city
  community: string;
  assetClass: AssetClass;
  priceMin: number; // local currency
  priceMax: number;
  currency: "AED" | "INR";
  status: "Off-plan" | "Under construction" | "Ready";
  handover: string;
  grossYield: number;
  lat: number;
  lng: number;
  units: number;
  hue: number; // used to render the typographic thumbnail
}

export interface Analyst {
  id: string;
  name: string;
  role: string;
}

export interface Mandate {
  id: string;
  clientId: string;
  propertyId: string;
  status: MandateStatus;
  analystId: string;
  createdAt: string;
  updatedAt: string;
  deadline: string;
  ticketSize: number; // USD
  objective: string;
  horizonYears: number;
  priority: "Standard" | "Priority";
}

export interface AuditEvent {
  id: string;
  mandateId?: string;
  actor: string;
  actorType: "agent" | "user" | "system";
  action: string;
  detail?: string;
  at: string;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  durationMs?: number;
}

export interface Memo {
  id: string;
  mandateId: string;
  title: string;
  status: "Draft" | "In review" | "Approved" | "Delivered";
  lastEditedAt: string;
  lastEditedBy: string;
  html: string;
}

export interface Citation {
  id: number;
  source: string;
  title: string;
  url?: string;
  date: string;
}

export interface ResearchSection {
  heading: string;
  body: string; // paragraphs separated by blank lines; [n] marks citations
}

export interface ResearchDossier {
  summary: string;
  sections: ResearchSection[];
  citations: Citation[];
  dataGaps: string[];
}

export interface Scenario {
  label: "P10" | "P50" | "P90";
  irr: number;
  npv: number;
  exitValue: number;
  equityMultiple: number;
  cashYield: number;
}

export interface CashFlowPoint {
  year: string;
  inflow: number;
  outflow: number;
  net: number;
  cumulative: number;
}

export interface SensitivityItem {
  driver: string;
  low: number; // IRR delta (pp) under downside
  high: number; // IRR delta (pp) under upside
}

export interface RiskAxis {
  axis: string;
  score: number; // 0–10, higher = riskier
}

export interface Underwriting {
  scenarios: Scenario[];
  cashflows: CashFlowPoint[];
  sensitivity: SensitivityItem[];
  risk: RiskAxis[];
  assumptions: { label: string; value: string }[];
}

export interface DDFinding {
  id: string;
  severity: Severity;
  category: string;
  title: string;
  description: string;
  evidence: string;
  action: string;
}

export interface DebateCase {
  thesis: string;
  points: { title: string; detail: string }[];
  confidence: number; // 0–1
}

export interface JudgeDecision {
  recommendation: Recommendation;
  rationale: string;
  conditions: string[];
  confidence: number;
}

export interface StageRun {
  stage: MandateStatus;
  agent: string;
  status: "complete" | "running" | "pending";
  startedAt?: string;
  durationMs?: number;
  costUsd?: number;
}

export interface MandateAnalysis {
  mandateId: string;
  timeline: StageRun[];
  recommendation: Recommendation;
  riskRating: RiskRating;
  research: ResearchDossier;
  underwriting: Underwriting;
  dd: DDFinding[];
  bull: DebateCase;
  bear: DebateCase;
  judge: JudgeDecision;
}

export interface DocumentItem {
  id: string;
  title: string;
  type: "Memo" | "Title Deed" | "SPA" | "Valuation" | "Statement" | "Research";
  mandateId?: string;
  clientId?: string;
  pages: number;
  sizeKb: number;
  createdAt: string;
}

export interface Holding {
  id: string;
  clientId: string;
  propertyId: string;
  acquiredAt: string;
  costUsd: number;
  valueUsd: number;
  irr: number;
  cashYield: number;
  status: "Performing" | "Watch" | "Under construction";
}

export interface PortfolioAlert {
  id: string;
  clientId: string;
  severity: Severity;
  title: string;
  detail: string;
  at: string;
}

export interface ClientRecommendation {
  id: string;
  clientId: string;
  type: "Rebalance" | "New opportunity" | "Exit window" | "Risk" | "Refinance";
  message: string;
  propertyId?: string;
  at: string;
}

export interface MarketMonth {
  month: string;
  transactions: number;
  medianPriceSqft: number;
  offPlanShare: number;
}

export interface SupplyPoint {
  year: string;
  units: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "analyst" | "client" | "admin";
  lastActive: string;
}
