import type { MandateAnalysis } from "./types";

interface MemoInputs {
  analysis: MandateAnalysis;
  clientName: string;
  propertyName: string;
  developerName: string;
  community: string;
  ticketSize: number;
  horizonYears: number;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Default memo draft assembled from the analysis until the memo-writer agent has run. */
export function buildMemoDraft(i: MemoInputs) {
  const a = i.analysis;
  const s = Object.fromEntries(a.underwriting.scenarios.map((x) => [x.label, x]));
  const risks = a.dd.filter((f) => f.severity === "critical" || f.severity === "high");
  return `
<h2>Recommendation</h2>
<p><strong>${esc(a.judge.recommendation)}.</strong> ${esc(a.judge.rationale)}</p>
<h2>Investment thesis</h2>
<p>${esc(a.research.summary)}</p>
<p>${esc(a.bull.thesis)}</p>
<h2>Returns</h2>
<p>On a USD ${(i.ticketSize / 1e6).toFixed(1)}M commitment over ${i.horizonYears} years, the base case (P50) delivers a levered IRR of ${s.P50!.irr.toFixed(1)}% and an equity multiple of ${s.P50!.equityMultiple.toFixed(2)}×. The downside case (P10) returns ${s.P10!.irr.toFixed(1)}%; the upside (P90) ${s.P90!.irr.toFixed(1)}%.</p>
<h2>Market</h2>
<p>${esc(a.research.sections[0]?.body.split(/\n\s*\n/)[0] ?? "")}</p>
<h2>Developer</h2>
<p>${esc(a.research.sections[2]?.body ?? "")}</p>
<h2>Key risks and mitigants</h2>
<ul>${(risks.length ? risks : a.dd.slice(0, 3)).map((r) => `<li><strong>${esc(r.title)}.</strong> ${esc(r.action)}</li>`).join("")}</ul>
<blockquote>${esc(a.bear.thesis)}</blockquote>
<h2>Conditions</h2>
<ol>${a.judge.conditions.map((c) => `<li>${esc(c)}</li>`).join("")}</ol>
<h2>Next steps</h2>
<p>Subject to client approval, we will issue the conditions to the developer, commission the site inspection and return with a final SPA mark-up within ten business days.</p>
`.trim();
}
