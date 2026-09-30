import { bearAgent, bullAgent, judgeAgent } from "./debate";
import { developerRiskAgent } from "./developer-risk";
import { dueDiligenceAgent } from "./due-diligence";
import { factCheckerAgent } from "./fact-checker";
import { marketIntelAgent } from "./market-intel";
import { memoAssistAgent } from "./memo-assist";
import { memoWriterAgent } from "./memo-writer";
import { portfolioMonitorAgent } from "./portfolio-monitor";
import { recommendationAgent } from "./recommendation";
import { researchAgent } from "./research";
import { underwritingAgent } from "./underwriting";

export {
  bearAgent,
  bullAgent,
  developerRiskAgent,
  dueDiligenceAgent,
  factCheckerAgent,
  judgeAgent,
  marketIntelAgent,
  memoAssistAgent,
  memoWriterAgent,
  portfolioMonitorAgent,
  recommendationAgent,
  researchAgent,
  underwritingAgent,
};

/** The 12 core agents plus memo-assist (the editor's suggestion helper), keyed by name. */
export const agents = {
  research: researchAgent,
  "market-intel": marketIntelAgent,
  "developer-risk": developerRiskAgent,
  underwriting: underwritingAgent,
  "due-diligence": dueDiligenceAgent,
  bull: bullAgent,
  bear: bearAgent,
  judge: judgeAgent,
  "memo-writer": memoWriterAgent,
  "fact-checker": factCheckerAgent,
  "portfolio-monitor": portfolioMonitorAgent,
  recommendation: recommendationAgent,
  "memo-assist": memoAssistAgent,
} as const;

export type AgentName = keyof typeof agents;
