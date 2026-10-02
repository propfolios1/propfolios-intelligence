# NAKHLA — AI Operating System for Real Estate Advisory

You are a staff engineer + design lead from Linear/Vercel/Stripe. You are
building "Nakhla" — a multi-tenant AI platform that runs research, underwriting,
due diligence, memos, and client portfolios for real estate advisory firms.

Tenant #1 is PropFolios.ae (Amol Bandekar, Abu Dhabi). Tenants #2 through #300
will onboard over the next 24 months through self-serve signup. The architecture
must support this from day one.

This is a $2M-craft product. Every pixel matters. Ship it end to end.

## Repository notes (read first)

- This repository began as PropFolios Intelligence (single tenant) and was
  evolved into Nakhla in place. Work on branch `claude/adoring-brown-6qrqag`.
- Next.js 15 App Router (not 14): route `params` and `searchParams` are Promises.
- Database: Neon Postgres via `DATABASE_URL`; without it an embedded PGlite
  database migrates and seeds itself (demo only). Migrations live in `drizzle/`.
- Without Clerk keys the app runs in demonstration mode (persona switching).
  Without `ANTHROPIC_API_KEY` the agents run in deterministic replay mode.
- Every tenant-owned query must be scoped with `lib/tenant-db.ts`
  (`tenantDb(tenantId)` / `scope(table, tenantId)`); unscoped access throws.
- `npm run type-check`, `npm run lint`, `npm test` and `npm run build` must pass
  before every commit. Commit messages end with the session attribution lines.

## RULES OF ENGAGEMENT

1. Never ask questions. Decide and build.
2. Never stop between features. Continuous execution.
3. Never leave TODOs. Implement everything.
4. Never use placeholder copy. Write real institutional copy.
5. Never ship default shadcn. Restyle every component.
6. Never commit broken code. `npm run build` must pass at every commit.
7. Commit every 30–60 minutes with descriptive messages.
8. Fix errors immediately and continue.
9. Build until the whole product is done, then run final verification.
10. The user never touches a terminal. Everything must work via Vercel UI.

## STACK — LOCKED

- Next.js App Router + TypeScript strict
- Tailwind + shadcn/ui (heavily customized)
- Clerk auth with Organizations (multi-tenant)
- Neon Postgres + Drizzle ORM, pgvector
- Anthropic SDK: claude-sonnet-4-20250514 + claude-haiku-4 (env overridable)
- TanStack Query + Zustand, Recharts, TipTap, @dnd-kit, cmdk, Zod
- @react-pdf/renderer, Vercel Blob, Vercel Cron, Framer Motion (sparingly)
- next/font (Playfair Display, Inter, JetBrains Mono), Sonner

## DESIGN SYSTEM — NON-NEGOTIABLE

Colors:
navy-900 #0A1F44 | navy-800 #0F2A5C | navy-700 #1A3A6B | navy-100 #E8EDF5 | navy-50 #F4F6FA
gold-600 #A8894A | gold-500 #C9A961 | gold-100 #F5EDDA
ink-900 #0A0A0A | ink-700 #374151 | ink-500 #6B7280 | ink-400 #9CA3AF | ink-200 #E5E7EB | ink-100 #F3F4F6
bg #FAFAF9 | surface #FFFFFF | success #059669 | warning #D97706 | danger #DC2626

Typography: Playfair Display (display), Inter (body), JetBrains Mono (numbers, tabular).
Scale 56/40/32/24/18/16/14/12. Spacing 8px base. Radius 6 buttons, 8 cards, 12 modals, 999 pills.
Borders 1px ink-200 only. Shadows: `0 1px 2px rgba(10,31,68,0.04)` and `0 8px 24px rgba(10,31,68,0.08)`.
Motion 150/250/400ms cubic-bezier(0.16,1,0.3,1); opacity/transform/color only; no spinners.
Gold on <5% of any screen. Tenant primary/accent colours override navy/gold via TenantProvider.

## MULTI-TENANCY — FIRST-CLASS

- Every table has `tenant_id`; every query filters by tenant; unscoped access throws.
- Postgres row-level security as second defence.
- Clerk org = tenant. Roles: platform_admin | tenant_admin | analyst | client.
- Tenant `config_json`: brand_name, logo_url, primary_color, accent_color,
  font_display, font_body, custom_domain, memo house style, feature flags.
- Plans: Starter (5 seats) AED 3,000/mo · Professional (20) AED 8,000/mo ·
  Enterprise (unlimited) AED 25,000/mo · White-label (custom domain) AED 50,000/mo.

## AI AGENTS — 12

research, underwriting (P10/P50/P90, risk, sensitivity), due-diligence, debate
(bull/bear/judge), memo (tenant house style), portfolio-monitor (weekly digest +
alerts), developer-risk (0–100), comparables (10 similar via pgvector),
market-timing (BUY/HOLD/SELL per emirate), cross-border (UAE vs India
arbitrage), nl-query (streaming), recommender. Zod schemas, tool-use structured
output, cost tracking, audit logs, retries (max 5, exponential backoff),
versioned prompts `_v1`. Orchestrator state machine INTAKE → RESEARCH →
UNDERWRITING → DUE_DILIGENCE → DEBATE → MEMO → REVIEW → DELIVERED with SSE.
Financial tools: irr, npv, xirr, Monte Carlo (10k runs), sensitivity, cash flows.

## PAGES

Public: `/`, `/pricing`, `/sign-in`, `/sign-up`, `/onboarding`.
Platform admin: `/platform/dashboard`, `/platform/tenants`, `/platform/tenants/[id]`,
`/platform/tenants/new`, `/platform/metrics`.
Tenant admin: `/admin/dashboard`, `/admin/users`, `/admin/branding`, `/admin/billing`,
`/admin/audit`, `/admin/seed`.
Analyst: dashboard, mandates, mandates/new, mandates/[id] (Overview, Research,
Underwriting, DD, Debate, Memo, Documents, Audit), properties, properties/[id],
developers, memos, memos/[id], market, settings.
Client: portfolio, opportunities, documents, messages, assistant, recommendations, settings.

## COPY

Formal, institutional. "Create Mandate", "Allocation Memo", "Due Diligence
Findings", "Portfolio Performance". No emojis. No exclamation marks.

## WHAT NOT TO BUILD

No Python, separate backend, Docker, Celery, Redis (unless Vercel KV / Upstash),
WhatsApp, DocuSign, CRM, mobile app, public API, fine-tuned models, SOC 2,
multi-region.

## FINAL TEST

Does this look like Linear/Vercel/Stripe built it? Would a tenant pay
AED 8,000/month without a demo call? Does the memo look typeset? Does the client
portal feel like private banking? If any answer is no, keep polishing.

Report in `docs/BUILD_REPORT.md`: total files, LOC, build status, known
limitations, deployment steps, screenshot list.
