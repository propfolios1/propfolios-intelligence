import { DD_GOA, DD_GOA_VERSION } from "./due_diligence_goa_v1";
import { DD_MAHARASHTRA, DD_MAHARASHTRA_VERSION } from "./due_diligence_maharashtra_v1";
import { GOA_CONTEXT, MAHARASHTRA_CONTEXT } from "./india_context_v1";
import { RESEARCH_INDIA_GOA, RESEARCH_INDIA_GOA_VERSION } from "./research_india_goa_v1";
import { RESEARCH_INDIA_MUMBAI, RESEARCH_INDIA_MUMBAI_VERSION } from "./research_india_mumbai_v1";
import { UNDERWRITING_INDIA, UNDERWRITING_INDIA_VERSION } from "./underwriting_india_v1";

type CoreAgent = "research" | "underwriting" | "due-diligence" | "memo" | "debate";
type Place = { market: string; region: string; city: string };

export function stateOf(p: Place): "MH" | "GA" | null {
  if (p.market !== "India") return null;
  if (/goa/i.test(p.region)) return "GA";
  if (/maharashtra/i.test(p.region)) return "MH";
  return null;
}

const ADDENDA: Record<CoreAgent, Record<"MH" | "GA", { text: string; version: string }>> = {
  research: { MH: { text: RESEARCH_INDIA_MUMBAI, version: RESEARCH_INDIA_MUMBAI_VERSION }, GA: { text: RESEARCH_INDIA_GOA, version: RESEARCH_INDIA_GOA_VERSION } },
  underwriting: { MH: { text: UNDERWRITING_INDIA, version: UNDERWRITING_INDIA_VERSION }, GA: { text: UNDERWRITING_INDIA, version: UNDERWRITING_INDIA_VERSION } },
  "due-diligence": { MH: { text: DD_MAHARASHTRA, version: DD_MAHARASHTRA_VERSION }, GA: { text: DD_GOA, version: DD_GOA_VERSION } },
  memo: { MH: { text: `JURISDICTION: the asset is in Maharashtra. Name MahaRERA, the Ready Reckoner and the stamp duty base in the transaction section.\n\n${MAHARASHTRA_CONTEXT}`, version: "jurisdiction_mh_v1" }, GA: { text: `JURISDICTION: the asset is in Goa. Address land use, CRZ, Comunidade and mundkar status in the risk section.\n\n${GOA_CONTEXT}`, version: "jurisdiction_ga_v1" } },
  debate: { MH: { text: `JURISDICTION: Maharashtra. Argue from MahaRERA status, Ready Reckoner position, approvals and redevelopment risk where relevant.\n\n${MAHARASHTRA_CONTEXT}`, version: "jurisdiction_mh_v1" }, GA: { text: `JURISDICTION: Goa. Argue from land use, conversion, CRZ, Comunidade and mundkar facts where relevant.\n\n${GOA_CONTEXT}`, version: "jurisdiction_ga_v1" } },
};

/**
 * Makes a core agent jurisdiction-aware: for Mumbai and Goa assets the
 * jurisdiction addendum is appended to the base prompt and its version is
 * recorded alongside the base version in the audit entry.
 */
export function withJurisdiction(agent: CoreAgent, base: string, baseVersion: string, place: Place) {
  const st = stateOf(place);
  if (!st) return { system: base, version: baseVersion };
  const a = ADDENDA[agent][st];
  return { system: `${base}\n\n${a.text}`, version: `${baseVersion}+${a.version}` };
}
