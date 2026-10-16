/**
 * What a client should do next, ranked. Pure: the Home page gathers the
 * records and this decides what deserves attention, in what order and how
 * urgently. Urgency is 0 to 100: legal and payment deadlines first, then
 * anything blocking a transaction, then reading.
 */

export type StepTone = "coral" | "sun" | "iris" | "sky" | "sea";
export type StepKind = "kyc" | "contract" | "invoice" | "report" | "recommendation" | "goal";

export interface NextStep {
  id: string;
  kind: StepKind;
  title: string;
  detail: string;
  href: string;
  cta: string;
  tone: StepTone;
  urgency: number;
  /** ISO date when the step falls due, when it has one. */
  due?: string;
}

export interface NextStepInput {
  kyc: { status: "draft" | "submitted" | "in_review" | "approved" | "rejected" | "expired"; expiresAt: Date | null } | null;
  contracts: { id: string; title: string; status: "draft" | "out_for_signature" | "signed" | "void"; deal: string }[];
  invoices: { id: string; number: string; status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void"; total: number; currency: string; dueAt: Date | null }[];
  reports: { id: string; title: string; type: string; viewedAt: Date | null; generatedAt: Date }[];
  recommendations: { id: string; title: string; priority: number }[];
  goals: { id: string; title: string; progressPct: number; by: string }[];
}

const DAY = 86_400_000;

function money(amount: number, currency: string) {
  return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
}

export function nextSteps(input: NextStepInput, now = new Date()): NextStep[] {
  const steps: NextStep[] = [];
  const k = input.kyc;
  if (!k || k.status === "draft" || k.status === "rejected" || k.status === "expired") {
    steps.push({
      id: "kyc",
      kind: "kyc",
      title: k?.status === "expired" ? "Renew your identity verification" : k?.status === "rejected" ? "Resubmit your identity verification" : "Verify your identity",
      detail: "Required by anti-money-laundering rules before any transaction can complete. It takes about five minutes with your passport and proof of address.",
      href: "/client/kyc",
      cta: k?.status === "draft" ? "Continue" : "Start",
      tone: "coral",
      urgency: 92,
    });
  } else if (k.status === "approved" && k.expiresAt && k.expiresAt.getTime() - now.getTime() < 45 * DAY) {
    const days = Math.max(0, Math.ceil((k.expiresAt.getTime() - now.getTime()) / DAY));
    steps.push({ id: "kyc-renew", kind: "kyc", title: "Identity verification expires soon", detail: `Your verification lapses in ${days} ${days === 1 ? "day" : "days"}. Renewing now keeps transactions moving without a pause.`, href: "/client/kyc", cta: "Renew", tone: "sun", urgency: 70 - Math.min(30, days / 2), due: k.expiresAt.toISOString() });
  }

  for (const c of input.contracts.filter((x) => x.status === "out_for_signature")) {
    steps.push({ id: `contract-${c.id}`, kind: "contract", title: `Sign ${c.title}`, detail: `For ${c.deal}. The transaction waits on your signature.`, href: "/client/contracts", cta: "Review and sign", tone: "iris", urgency: 85 });
  }

  for (const inv of input.invoices.filter((x) => x.status === "issued" || x.status === "overdue" || x.status === "partially_paid")) {
    const overdue = inv.status === "overdue" || (inv.dueAt !== null && inv.dueAt.getTime() < now.getTime());
    const days = inv.dueAt ? Math.ceil((inv.dueAt.getTime() - now.getTime()) / DAY) : null;
    steps.push({
      id: `invoice-${inv.id}`,
      kind: "invoice",
      title: overdue ? `Invoice ${inv.number} is overdue` : `Invoice ${inv.number} is due`,
      detail: `${money(inv.total, inv.currency)}${days === null ? "" : overdue ? `, ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} past due` : `, due in ${days} ${days === 1 ? "day" : "days"}`}.`,
      href: "/client/invoices",
      cta: "View invoice",
      tone: overdue ? "coral" : "sun",
      urgency: overdue ? 88 : Math.max(40, 75 - Math.max(0, days ?? 30)),
      due: inv.dueAt?.toISOString(),
    });
  }

  const unread = input.reports.filter((r) => !r.viewedAt).sort((a, b) => b.generatedAt.getTime() - a.generatedAt.getTime());
  for (const r of unread.slice(0, 2)) {
    const fresh = now.getTime() - r.generatedAt.getTime() < 14 * DAY;
    steps.push({ id: `report-${r.id}`, kind: "report", title: `Read ${r.title}`, detail: r.type === "market_brief" ? "A new brief on a market you follow." : "Performance, income and the outlook for each holding.", href: `/client/reports/${r.id}`, cta: "Read", tone: "sky", urgency: fresh ? 45 : 30 });
  }

  for (const rec of [...input.recommendations].sort((a, b) => a.priority - b.priority).slice(0, 2)) {
    steps.push({ id: `rec-${rec.id}`, kind: "recommendation", title: rec.title, detail: "Your advisory team recommends this. Accept it, ask a question or set it aside.", href: "/client/recommendations", cta: "Review", tone: "sea", urgency: rec.priority <= 1 ? 60 : 40 });
  }

  for (const g of input.goals.filter((x) => x.progressPct < 50)) {
    const by = new Date(g.by);
    if (Number.isNaN(by.getTime()) || by.getTime() - now.getTime() > 365 * DAY) continue;
    steps.push({ id: `goal-${g.id}`, kind: "goal", title: `Behind plan: ${g.title}`, detail: `${Math.round(g.progressPct)}% of the way with the target date within a year. Your adviser can propose ways to close the gap.`, href: "/client/goals", cta: "See goal", tone: "sun", urgency: 50 });
  }

  return steps.sort((a, b) => b.urgency - a.urgency || a.title.localeCompare(b.title));
}

/** Share of standing obligations met: verification current, nothing to sign, nothing unpaid. */
export function readiness(input: NextStepInput): { pct: number; done: number; total: number } {
  const checks = [input.kyc?.status === "approved", input.contracts.every((c) => c.status !== "out_for_signature"), input.invoices.every((i) => i.status === "paid" || i.status === "void" || i.status === "draft"), input.reports.every((r) => r.viewedAt !== null)];
  const done = checks.filter(Boolean).length;
  return { pct: Math.round((done / checks.length) * 100), done, total: checks.length };
}
