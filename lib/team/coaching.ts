import type { AgentMetricSet, CoachingFlag } from "@/db/schema-production";

/**
 * Coaching rules. Each agent is compared with the team's median for the same
 * period, so the bar moves with the market and the firm rather than with a
 * fixed number. A rule only fires with enough volume to be fair (a 0% rate on
 * two leads is noise). Recognitions use the same comparisons, so a manager
 * sees what to repeat as well as what to fix.
 */

export const METRICS: { key: keyof AgentMetricSet; label: string; better: "higher" | "lower"; format: "count" | "pct" | "hours" | "days" | "money" }[] = [
  { key: "gci", label: "Gross commission", better: "higher", format: "money" },
  { key: "dealsClosed", label: "Deals closed", better: "higher", format: "count" },
  { key: "dealValue", label: "Value closed", better: "higher", format: "money" },
  { key: "conversionPct", label: "Lead conversion", better: "higher", format: "pct" },
  { key: "medianResponseHours", label: "First response", better: "lower", format: "hours" },
  { key: "leadsAssigned", label: "Leads assigned", better: "higher", format: "count" },
  { key: "activities", label: "Activities logged", better: "higher", format: "count" },
  { key: "viewings", label: "Viewings", better: "higher", format: "count" },
  { key: "listingsTaken", label: "Listings taken", better: "higher", format: "count" },
  { key: "avgDaysOnMarket", label: "Days on market", better: "lower", format: "days" },
  { key: "pipelineValue", label: "Weighted pipeline", better: "higher", format: "money" },
  { key: "overdueFollowUps", label: "Overdue follow-ups", better: "lower", format: "count" },
  { key: "staleLeads", label: "Stale leads", better: "lower", format: "count" },
];

export function median(xs: (number | null)[]) {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m]! : (v[m - 1]! + v[m]!) / 2;
}

export function medians(sets: AgentMetricSet[]) {
  return Object.fromEntries(METRICS.map((m) => [m.key, median(sets.map((s) => s[m.key] as number | null))])) as Partial<Record<keyof AgentMetricSet, number | null>>;
}

export function totals(sets: AgentMetricSet[]): AgentMetricSet {
  const sum = (k: keyof AgentMetricSet) => sets.reduce((a, s) => a + ((s[k] as number | null) ?? 0), 0);
  const assigned = sum("leadsAssigned");
  const decided = sum("leadsWon") + sum("leadsLost");
  return {
    leadsAssigned: assigned,
    leadsContacted: sum("leadsContacted"),
    leadsWon: sum("leadsWon"),
    leadsLost: sum("leadsLost"),
    conversionPct: decided ? Math.round((sum("leadsWon") / decided) * 1000) / 10 : null,
    medianResponseHours: median(sets.map((s) => s.medianResponseHours)),
    activities: sum("activities"),
    calls: sum("calls"),
    messages: sum("messages"),
    viewings: sum("viewings"),
    listingsTaken: sum("listingsTaken"),
    activeListings: sum("activeListings"),
    avgDaysOnMarket: median(sets.map((s) => s.avgDaysOnMarket)),
    dealsClosed: sum("dealsClosed"),
    dealValue: sum("dealValue"),
    gci: Math.round(sum("gci") * 100) / 100,
    pipelineValue: sum("pipelineValue"),
    overdueFollowUps: sum("overdueFollowUps"),
    staleLeads: sum("staleLeads"),
  };
}

/** Standard competition ranking (1, 2, 2, 4); people with no value are left off. */
export function leaderboard(rows: { userId: string; name: string; m: AgentMetricSet }[], key: keyof AgentMetricSet, better: "higher" | "lower" = "higher", limit = 10) {
  const vals = rows.map((r) => ({ userId: r.userId, name: r.name, value: r.m[key] as number | null })).filter((r): r is { userId: string; name: string; value: number } => r.value !== null && (better === "lower" || r.value > 0));
  vals.sort((a, b) => (better === "higher" ? b.value - a.value : a.value - b.value) || a.name.localeCompare(b.name));
  let rank = 0;
  return vals.slice(0, limit).map((v, i) => {
    if (i === 0 || v.value !== vals[i - 1]!.value) rank = i + 1;
    return { ...v, rank };
  });
}

const r1 = (x: number) => Math.round(x * 10) / 10;

export function coachingFlags(m: AgentMetricSet, med: Partial<Record<keyof AgentMetricSet, number | null>>, ctx: { target?: { gci: number | null; dealsClosed: number | null }; periodElapsed?: number } = {}): CoachingFlag[] {
  const out: CoachingFlag[] = [];
  const md = (k: keyof AgentMetricSet) => med[k] ?? null;
  // First response: slower than twice the team median, and over two hours.
  if (m.medianResponseHours !== null && m.leadsAssigned >= 5) {
    const b = md("medianResponseHours");
    if (m.medianResponseHours > 2 && (b === null || m.medianResponseHours > b * 2)) out.push({ key: "slow_response", kind: "concern", severity: m.medianResponseHours > 24 ? "high" : "medium", title: "Slow first response", detail: `Median first response of ${r1(m.medianResponseHours)} hours${b !== null ? ` against a team median of ${r1(b)}` : ""}. Leads contacted within the hour convert markedly better.`, value: r1(m.medianResponseHours), benchmark: b === null ? null : r1(b), action: "Turn on the lead response assistant for this agent's leads, or set push notifications for new leads on the mobile app." });
  }
  if (m.conversionPct !== null && m.leadsWon + m.leadsLost >= 10) {
    const b = md("conversionPct");
    if (b !== null && b > 0 && m.conversionPct < b * 0.5) out.push({ key: "low_conversion", kind: "concern", severity: "medium", title: "Low conversion", detail: `${r1(m.conversionPct)}% of decided leads won, half the team median of ${r1(b)}%.`, value: m.conversionPct, benchmark: b, action: "Review five recent lost leads together: the lost reasons, the qualification gaps and the first message sent." });
    if (b !== null && m.conversionPct >= b * 1.5 && m.leadsWon >= 3) out.push({ key: "top_conversion", kind: "recognition", severity: "low", title: "Strong conversion", detail: `${r1(m.conversionPct)}% of decided leads won against a team median of ${r1(b)}%.`, value: m.conversionPct, benchmark: b, action: "Ask the agent to walk the team through how they qualify and follow up." });
  }
  if (m.overdueFollowUps >= 5) out.push({ key: "overdue_followups", kind: "concern", severity: m.overdueFollowUps >= 15 ? "high" : "medium", title: "Follow-ups overdue", detail: `${m.overdueFollowUps} leads are past their next-action date.`, value: m.overdueFollowUps, benchmark: md("overdueFollowUps"), action: "Clear the overdue list today: call, reschedule with a reason, or close as lost." });
  const active = Math.max(1, m.leadsAssigned - m.leadsWon - m.leadsLost);
  if (m.staleLeads >= 5 && m.staleLeads / active >= 0.3) out.push({ key: "stale_pipeline", kind: "concern", severity: "medium", title: "Leads going cold", detail: `${m.staleLeads} open leads have had no contact for seven days or more, ${Math.round((m.staleLeads / active) * 100)}% of the agent's open leads.`, value: m.staleLeads, benchmark: md("staleLeads"), action: "Add the stale leads to a nurture sequence in Marketing, and reassign any the agent cannot work this week." });
  const dom = md("avgDaysOnMarket");
  if (m.avgDaysOnMarket !== null && dom !== null && m.activeListings >= 3 && m.avgDaysOnMarket > dom * 1.5) out.push({ key: "aging_listings", kind: "concern", severity: "low", title: "Listings ageing", detail: `Average ${Math.round(m.avgDaysOnMarket)} days on market against a team median of ${Math.round(dom)}.`, value: Math.round(m.avgDaysOnMarket), benchmark: Math.round(dom), action: "Review pricing on the oldest listings against recent comparables, and refresh photos and portal copy." });
  const act = md("activities");
  if (act !== null && act >= 10 && m.activities < act * 0.5) out.push({ key: "low_activity", kind: "concern", severity: "low", title: "Low recorded activity", detail: `${m.activities} calls, messages, emails and viewings logged against a team median of ${Math.round(act)}.`, value: m.activities, benchmark: Math.round(act), action: "Check whether activity is happening but not being logged; WhatsApp through the firm's number is logged automatically." });
  if (ctx.target?.gci && ctx.periodElapsed && ctx.periodElapsed >= 1 / 3) {
    const pace = m.gci / (ctx.target.gci * ctx.periodElapsed);
    if (pace < 0.7) out.push({ key: "target_risk", kind: "concern", severity: pace < 0.4 ? "high" : "medium", title: "Behind target pace", detail: `${Math.round(pace * 100)}% of the pace needed to reach this quarter's commission target.`, value: Math.round(pace * 100), benchmark: 100, action: "Agree the three deals most likely to close this quarter and what each needs." });
    if (pace >= 1.2) out.push({ key: "ahead_of_target", kind: "recognition", severity: "low", title: "Ahead of target", detail: `${Math.round(pace * 100)}% of the pace needed for this quarter's commission target.`, value: Math.round(pace * 100), benchmark: 100, action: "Recognise publicly; consider a stretch target." });
  }
  const gci = md("gci");
  if (gci !== null && gci > 0 && m.gci >= gci * 2 && m.dealsClosed >= 2) out.push({ key: "top_producer", kind: "recognition", severity: "low", title: "Top producer", detail: `Commission at ${r1(m.gci / gci)} times the team median.`, value: Math.round(m.gci), benchmark: Math.round(gci), action: "Recognise publicly and pair with a newer agent on their next listing." });
  return out;
}
