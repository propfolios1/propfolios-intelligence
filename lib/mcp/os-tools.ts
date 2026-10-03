import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import * as s from "@/db/schema";
import { HttpError } from "@/lib/auth";
import { runAmlScreener, runKycAnalyzer } from "@/lib/client/agents";
import { latestAml } from "@/lib/client/aml";
import { MARKETS } from "@/lib/bi/agents";
import { listMarketReports, visibleBenchmarks } from "@/lib/bi/service";
import { clerkEnabled } from "@/lib/auth";
import { listCommissions } from "@/lib/commission/service";
import { getClient360 } from "@/lib/data-model";
import { createOffer, getDeal, listDeals } from "@/lib/deals/service";
import { scope } from "@/lib/tenant-db";
import type { ToolContext } from "./tools";

interface ToolDef<S extends z.ZodObject> {
  title: string;
  description: string;
  input: S;
  heavy?: boolean;
  run: (ctx: ToolContext, args: z.infer<S>) => Promise<unknown>;
}
const def = <S extends z.ZodObject>(d: ToolDef<S>) => d;
const uuid = z.string().uuid();
const staff = (ctx: ToolContext) => {
  if (ctx.user.role === "client") throw new HttpError(403, "This tool is for the firm's staff.");
};
const ownClient = (ctx: ToolContext, clientId: string) => {
  if (ctx.user.role === "client" && ctx.user.clientId !== clientId) throw new HttpError(404, "Client not found.");
};

/** Vertical-OS tools: deals, commissions, clients, benchmarks, market reports, KYC and AML. */
export const OS_TOOLS = {
  list_deals: def({
    title: "List deals",
    description: "Deals in the pipeline with stage, status, value and forecast probability. Clients see only their own.",
    input: z.object({ status: z.enum(["active", "won", "lost", "on_hold"]).optional(), limit: z.number().int().min(1).max(50).default(20) }),
    run: async ({ db, user }, a) => (await listDeals(db, user.tenantId, { status: a.status, ...(user.role === "client" ? { clientId: user.clientId ?? "00000000-0000-0000-0000-000000000000" } : {}) })).slice(0, a.limit).map((r) => ({ id: r.deal.id, reference: r.deal.reference, title: r.deal.title, client: r.client, property: r.property, jurisdiction: r.deal.jurisdiction, stage: r.deal.stage, status: r.deal.status, value: r.deal.value, currency: r.deal.currency, probability: r.deal.probability, targetCloseDate: r.deal.targetCloseDate })),
  }),
  get_deal_status: def({
    title: "Get deal status",
    description: "One deal's stage history, offers, contracts and signatures, open checklist items and payment schedule.",
    input: z.object({ dealId: uuid }),
    run: async (ctx, a) => {
      const d = await getDeal(ctx.db, ctx.user.tenantId, a.dealId);
      if (!d) throw new HttpError(404, "Deal not found.");
      ownClient(ctx, d.deal.clientId);
      return { reference: d.deal.reference, title: d.deal.title, stage: d.deal.stage, status: d.deal.status, value: d.deal.value, currency: d.deal.currency, stages: d.stages.map((x) => ({ stage: x.name, enteredAt: x.enteredAt, completedAt: x.completedAt })), offers: d.offers.map((o) => ({ type: o.type, party: o.party, amount: o.amount, status: o.status })), contracts: d.contracts.map((c) => ({ title: c.title, status: c.status, signatures: d.signatures.filter((x) => x.contractId === c.id).map((x) => ({ party: x.party, status: x.status })) })), openChecklist: d.checklist.filter((c) => c.status === "open" || c.status === "in_progress").map((c) => ({ item: c.item, severity: c.severity, due: c.dueDate })), payments: d.payments.map((p) => ({ milestone: p.milestone, amount: p.amount, due: p.dueDate, status: p.status })) };
    },
  }),
  create_offer: def({
    title: "Create offer",
    description: "Records an offer or counter-offer on a deal; submitted offers raise deal.offer_sent and run the negotiation coach.",
    input: z.object({ dealId: uuid, party: z.enum(["buyer", "seller"]), amount: z.number().positive(), type: z.enum(["offer", "counter", "final"]).default("offer"), submit: z.boolean().default(false), depositPct: z.number().min(0).max(100).optional(), completionDays: z.number().int().min(1).max(730).optional() }),
    run: async (ctx, a) => {
      staff(ctx);
      const o = await createOffer(ctx.db, { tenantId: ctx.user.tenantId, name: ctx.user.name }, a.dealId, { type: a.type, party: a.party, amount: a.amount, submit: a.submit, terms: { depositPct: a.depositPct, completionDays: a.completionDays } });
      return { id: o.id, status: o.status, amount: o.amount, currency: o.currency };
    },
  }),
  list_commissions: def({
    title: "List commissions",
    description: "Commissions by deal with structure, amount, status, invoice and splits. Staff only.",
    input: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
    run: async (ctx, a) => {
      staff(ctx);
      return (await listCommissions(ctx.db, ctx.user.tenantId)).slice(0, a.limit).map((r) => ({ deal: r.deal.reference, client: r.client, structure: r.structure, amount: r.commission.amount, currency: r.commission.currency, percentage: r.commission.percentage, status: r.commission.status, invoice: r.invoice?.number ?? null, splits: r.splits.map((x) => ({ label: x.split.label, user: x.user, amount: x.split.amount, status: x.split.status })) }));
    },
  }),
  get_commission_structure: def({
    title: "Get commission structures",
    description: "The firm's commission structures: method, rate or tiers, scope, payer and splits.",
    input: z.object({ activeOnly: z.boolean().default(true) }),
    run: async (ctx, a) => {
      staff(ctx);
      const rows = await ctx.db.select().from(s.commissionStructures).where(scope(s.commissionStructures, ctx.user.tenantId, a.activeOnly ? eq(s.commissionStructures.active, true) : undefined));
      return rows.map((r) => ({ name: r.name, type: r.type, ratePct: r.ratePct, tiers: r.tiers, appliesTo: r.appliesTo, payer: r.payer, splits: r.splits, isDefault: r.isDefault }));
    },
  }),
  get_client_360: def({
    title: "Get client 360",
    description: "Everything about one client: profile, KYC and screening, portfolio, mandates, deals, invoices, reports, goals and engagement.",
    input: z.object({ clientId: uuid }),
    run: async (ctx, a) => {
      ownClient(ctx, a.clientId);
      const r = await getClient360(ctx.db, ctx.user.tenantId, a.clientId);
      if (!r) throw new HttpError(404, "Client not found.");
      return r;
    },
  }),
  list_client_documents: def({
    title: "List client documents",
    description: "Documents held for a client (memos, agreements, statements, KYC, land records), newest first.",
    input: z.object({ clientId: uuid, limit: z.number().int().min(1).max(50).default(20) }),
    run: async (ctx, a) => {
      ownClient(ctx, a.clientId);
      const rows = await ctx.db.select({ id: s.documents.id, title: s.documents.title, type: s.documents.type, pages: s.documents.pages, createdAt: s.documents.createdAt }).from(s.documents).where(and(scope(s.documents, ctx.user.tenantId), eq(s.documents.clientId, a.clientId))).orderBy(desc(s.documents.createdAt)).limit(a.limit);
      return rows;
    },
  }),
  get_benchmarks: def({
    title: "Get benchmarks",
    description: "Anonymised cross-firm benchmarks (published at five firms and twenty observations) by category and market. Firms that contribute only.",
    input: z.object({ category: z.string().optional(), region: z.string().optional() }),
    run: async (ctx, a) => {
      const [t] = await ctx.db.select({ consent: s.tenants.consentFederation }).from(s.tenants).where(eq(s.tenants.id, ctx.user.tenantId));
      if (!t?.consent) throw new HttpError(403, "Benchmarks are available to firms that opt in to federated learning.");
      const rows = await visibleBenchmarks(ctx.db, { includeIndicative: !clerkEnabled });
      return rows.filter((b) => (!a.category || b.category === a.category) && (!a.region || b.region.toLowerCase() === a.region.toLowerCase())).map((b) => ({ metric: b.metric, category: b.category, segment: b.segment, region: b.region, median: b.value, p25: b.p25, p75: b.p75, unit: b.unit, firms: b.firms, observations: b.sampleSize, status: b.published ? "published" : "indicative" }));
    },
  }),
  get_market_report: def({
    title: "Get market report",
    description: `Latest market pulse or quarterly outlook for ${MARKETS.map((m) => m.region).join(", ")}. Clients receive reports shared with them.`,
    input: z.object({ region: z.enum(MARKETS.map((m) => m.region) as [string, ...string[]]), type: z.enum(["monthly_pulse", "quarterly_outlook"]).default("monthly_pulse") }),
    run: async (ctx, a) => {
      const rows = await listMarketReports(ctx.db, ctx.user.tenantId, { sharedOnly: ctx.user.role === "client" });
      const r = rows.find((x) => x.region === a.region && x.type === a.type);
      if (!r) throw new HttpError(404, `No ${a.type.replace("_", " ")} for ${a.region} yet.`);
      return { title: r.title, generatedAt: r.generatedAt, ...r.content };
    },
  }),
  run_kyc: def({
    title: "Run KYC assessment",
    description: "Runs the KYC analyzer on a client's file: readiness, risk rating, missing and expiring documents. Staff only.",
    input: z.object({ clientId: uuid }),
    heavy: true,
    run: async (ctx, a) => {
      staff(ctx);
      const r = await runKycAnalyzer(ctx.db, { tenantId: ctx.user.tenantId, name: ctx.user.name }, a.clientId);
      return { ...r.output, costUsd: r.costUsd };
    },
  }),
  check_aml_status: def({
    title: "Check AML status",
    description: "Latest sanctions, PEP and adverse media screening for a client; with rescreen=true, screens again and dispositions the alerts. Staff only.",
    input: z.object({ clientId: uuid, rescreen: z.boolean().default(false) }),
    heavy: true,
    run: async (ctx, a) => {
      staff(ctx);
      if (a.rescreen) {
        const r = await runAmlScreener(ctx.db, { tenantId: ctx.user.tenantId, name: ctx.user.name }, a.clientId, { rescreen: true });
        return { ...r.output, costUsd: r.costUsd };
      }
      const { latest } = await latestAml(ctx.db, ctx.user.tenantId, a.clientId);
      if (!latest.length) throw new HttpError(404, "Not screened yet; call again with rescreen=true.");
      return latest.map((x) => ({ type: x.type, status: x.status, provider: x.provider, alerts: x.flags, checkedAt: x.checkedAt, reviewedBy: x.reviewedBy }));
    },
  }),
} as const;
