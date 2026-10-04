import type { LeadIntent, LeadTimeline, ScoreFactor } from "@/db/schema-brokerage";

/**
 * Lead score, 0 to 100, from facts a broker can check: how reachable the lead
 * is, how soon they intend to move, whether the budget fits what they asked
 * about, where they came from, and how recently the firm has engaged. Every
 * point is itemised so the score can be challenged.
 */

export interface ScoreInput {
  email: string | null;
  phone: string | null;
  intent: LeadIntent;
  timeline: LeadTimeline;
  source: string;
  budgetMin: number | null;
  budgetMax: number | null;
  /** Asking price of the listing the lead enquired about, in the same currency. */
  listingPrice: number | null;
  /** Activities in the last fourteen days that involved the lead (calls answered, viewings, replies). */
  recentEngagements: number;
  daysSinceContact: number | null;
  daysSinceCreated: number;
}

const TIMELINE: Record<LeadTimeline, number> = { immediate: 25, "3_months": 20, "6_months": 12, "12_months": 6, exploring: 2 };
const INTENT: Record<LeadIntent, number> = { buy: 10, sell: 10, invest: 10, rent: 6, let: 8 };
const SOURCE: Record<string, number> = { referral: 15, walk_in: 12, website: 10, whatsapp: 10, meta_ads: 5, google_ads: 6 };

export function scoreLead(i: ScoreInput): { score: number; factors: ScoreFactor[] } {
  const f: ScoreFactor[] = [];
  const reach = (i.phone ? 10 : 0) + (i.email ? 5 : 0) + (i.phone && i.email ? 5 : 0);
  f.push({ label: "Contactability", points: reach, detail: i.phone && i.email ? "Phone and email" : i.phone ? "Phone only" : i.email ? "Email only" : "No direct contact details" });
  f.push({ label: "Timeline", points: TIMELINE[i.timeline], detail: i.timeline.replace("_", " ") });
  f.push({ label: "Intent", points: INTENT[i.intent], detail: i.intent });

  let budget = 0;
  let budgetDetail = "No budget stated";
  if (i.budgetMax || i.budgetMin) {
    budget = 10;
    budgetDetail = "Budget stated";
    if (i.listingPrice && i.budgetMax) {
      const gap = (i.listingPrice - i.budgetMax) / i.listingPrice;
      if (gap <= 0.15) {
        budget += 10;
        budgetDetail = "Budget covers the asking price within 15%";
      } else if (gap <= 0.3) {
        budget += 5;
        budgetDetail = "Budget within 30% of the asking price";
      } else budgetDetail = "Budget more than 30% below the asking price";
    }
  }
  f.push({ label: "Budget fit", points: budget, detail: budgetDetail });

  const src = SOURCE[i.source] ?? 8;
  f.push({ label: "Source", points: src, detail: i.source in SOURCE ? i.source.replace("_", " ") : "Portal enquiry" });

  const engagement = Math.min(15, i.recentEngagements * 3);
  f.push({ label: "Engagement", points: engagement, detail: `${i.recentEngagements} interactions in the last 14 days` });

  const stale = i.daysSinceContact === null ? (i.daysSinceCreated > 2 ? -10 : 0) : i.daysSinceContact > 21 ? -10 : 0;
  if (stale) f.push({ label: "Decay", points: stale, detail: i.daysSinceContact === null ? "Not contacted within two days of arriving" : "No contact for more than 21 days" });

  const score = Math.max(0, Math.min(100, f.reduce((a, x) => a + x.points, 0)));
  return { score, factors: f };
}

export const scoreBand = (s: number) => (s >= 70 ? "Hot" : s >= 45 ? "Warm" : "Cold");
