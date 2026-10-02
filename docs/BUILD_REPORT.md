# Nakhla: build report

Release v1.0 · branch `claude/adoring-brown-6qrqag` · 2 October 2026

Nakhla is a multi-tenant, multi-agent AI operating system for real estate advisory firms, on Supabase (Postgres with pgvector, Storage, Realtime, row-level security) and Vercel. Tenant number one is PropFolios.ae.

## 1. Size

| Measure | Count |
| --- | --- |
| Files in the repository | 449 |
| Source files (TypeScript, TSX, CSS, SQL) | 381 |
| Lines of source | 26,688 |
| of which `app/` (pages and API routes) | 5,926 |
| of which `components/` | 9,475 |
| of which `lib/` (agents, prompts, orchestrator, cross-validation, insights, actions, federation, MCP, storage, auth, tenancy) | 7,644 |
| of which `db/` (schema, connection, seed) | 2,588 |
| of which `drizzle/` (SQL migrations: RLS, storage, Realtime, triggers) | 987 |
| Pages | 51 |
| API route handlers | 59 |
| Database tables | 28 |
| AI agents | 13 domain agents (the twelve specified plus the action planner) and the streaming assistant; insight narrator; three-model cross-validation panel |
| Versioned prompts | 29 files (`_v1` to `_v3`; every earlier version kept) |
| Components | 40+ (including ConfidenceMeter, CrossValidationBadge, InsightCard, ActionButton, FederationStats, CitationsList, MonteCarloHistogram, MoneyInput, PercentageInput, DateRangePicker, FilterBuilder, ExportMenu, RealtimeIndicator, DebateTranscript, TenantProvider, BrandMark) |

## 2. Security

| Measure | Value |
| --- | --- |
| Row-level security policies on tenant tables | **100** (25 tables × select, insert, update, delete) |
| Storage policies | 4 on `storage.objects` (tenant prefix; clients limited to their own folder) |
| Tables closed to all non-service roles | 3 federation tables (RLS on, no policies) |
| Anonymous (`anon`) access | None: all privileges revoked |
| Signed-in (`authenticated`) access | Read-only through the policies; all writes go through the server |

Policies resolve the caller from Clerk JWT claims via `auth.jwt()`: the user's own record (`sub`) decides the tenant, so a forged organisation claim cannot move a user into another firm; `org_id` (or Clerk's compact `o.id`) is used when the user has no record yet. Client users see only their own client, holdings, documents, messages and client-facing insights, and none of the internal tables (simulations, debates, cross-validations, actions, audit, users).

## 3. Federation (seeded demonstration)

| Measure | Value |
| --- | --- |
| Learnings in the pool | 5 (three delivered mandates from PropFolios, Gulf Realty Advisors and Bombay Property Intelligence; two archived from a former tenant) |
| Contributing advisories | 4 |
| Published baselines | 3: Dubai Residential (5 deals, 4 firms), UAE market (5 deals, 4 firms), one developer signal (4 deals, 4 firms) |
| Suppressed groups (below 3 deals or 2 firms) | 6 |
| Anonymisation | Salted SHA-256 for tenant, mandate, property and developer; no names, prices, clients or free text |

## 4. Build and verification

| # | Check | Result |
| --- | --- | --- |
| 1 | `npm install` | Pass |
| 2 | `npm run type-check` (TypeScript strict) | Pass, 0 errors |
| 3 | `npm run lint` | Pass, 0 errors, 0 warnings |
| 4 | `npm run build` | Pass |
| 5 | Every page, four personas, production build | 48 page loads incl. every mandate tab, the demo run and all new pages: all HTTP 200, **0 browser errors** |
| 6 | API routes | Exercised: setup, mandates, run, stream (SSE), cross-validate, debate, actions (propose, execute, reverse, dismiss), insights (scan, read, dismiss), federation consent and stats, platform aggregate and metrics, MCP (JSON-RPC and REST), documents and download, branding logo, envelopes, share links, crons |
| 7 | Multi-tenancy, three tenants, application layer | Pass: disjoint mandates, properties and clients; cross-tenant reads and uploads return 404 |
| 7 | Multi-tenancy, RLS layer (direct queries as `authenticated` with Clerk-style JWT claims) | Pass: each org sees one tenant; forged org claim ignored; client sees 1 client and only `both`-audience insights; no claims: 0 rows; `anon` denied; writes denied |
| 8 | Supabase Realtime | Publication covers portfolios, insights, recommendations, actions, market_data (verified); browser subscription code with polling fallback; **not tested against a live Supabase project** (see limitations) |
| 9 | Supabase Storage | Bucket creation (SQL and Storage API), tenant-prefix policies verified in Postgres; signed-URL download route; **live upload not tested** (no Supabase project reachable from the build environment) |
| 10 | SSE streaming end to end | Pass: Intake to Review, including valuation and cross-validation |
| 11 | PDF export | Pass, HTTP 200 `application/pdf`, tenant house style |
| 12 | Federation aggregation | Pass: consent backfill, withdrawal, k-anonymous publication, nightly cron |
| 13 | Cross-validation flags disagreements | Pass: seeded MND-0001 split 2:1 and resolved by the committee; on-demand runs set and clear the review flag |
| 14 | Debate produces bull, bear and judge | Pass |
| 15 | MCP server responds | Pass: `initialize`, `tools/list` (6 tools), `tools/call`, REST mirror; create_mandate, run_research, get_portfolio, get_market_data, get_developer_risk exercised with an API key |
| 16 | Actions reversible | Pass: lender link revoked (share page 404 after reversal); shared memo withdrawn; follow-ups, escalations, client-record edits restored |
| 17 | Seed idempotent | Pass: second `/api/setup` run reports no changes |
| 18 | RLS: tenant A cannot read tenant B with direct client queries | Pass (see row 7) |
| 19 | README complete | Click-by-click for every step and the five troubleshooting areas |
| — | `npm test` (financial engine) | 10 of 10 pass |
| — | Embedded (no database) mode | Pass: migrates, seeds and serves every layer |

Verification ran against PostgreSQL 16 with pgvector configured like Supabase (`auth.jwt()`, `anon` and `authenticated` roles, a `storage` schema and a `supabase_realtime` publication), connected through a Supabase-format pooler address.

## 5. Known limitations and deviations

1. **Repository and branch.** Built in `propfolios-intelligence` on branch `claude/adoring-brown-6qrqag` (this session cannot create repositories or push to `main`).
2. **Next.js 15, not 14.** The current supported line; route params are asynchronous.
3. **Models.** Defaults follow the specification (`claude-opus-4-20250514`, `claude-sonnet-4-20250514`, `claude-haiku-4-5`); Opus 4 and Sonnet 4 are deprecated by Anthropic. Set `ANTHROPIC_MODEL_DEEP=claude-opus-5-5` and `ANTHROPIC_MODEL_PRIMARY=claude-sonnet-5-5` for current models.
4. **Not exercised against a live Supabase project.** RLS, Storage policies and the Realtime publication were verified in a Supabase-like Postgres; Storage uploads and Realtime delivery depend on the project's third-party auth setup (README step 6).
5. **Scheduling uses Vercel Cron, not Supabase Edge Functions** (the specification allows either; one mechanism keeps deployment in the Vercel UI). The insight agent runs daily, because Vercel Hobby allows daily cron jobs only, and additionally whenever new market data arrives (database trigger plus refresh on the next page load). Pro deployments can set it to every six hours.
6. **Database triggers mark insights stale rather than calling agents.** Postgres cannot call the agents directly without extensions; the trigger flags the tenant and the next scan runs it.
7. **Server queries connect as the table owner** and are isolated by the application layer; RLS governs every browser (Supabase client) query and any other role. Policies are enabled, not forced.
8. **Actions run inside the platform.** Without WhatsApp, DocuSign or CRM integrations (excluded by instruction), executors act in Nakhla: memos shared to the client portal, signature envelopes signed in the portal (typed name, timestamp, source address), expiring lender links, follow-ups, client-record updates, escalation, rent reminders as portal messages with the firm's payment instructions. No email is sent.
9. **ivfflat versus HNSW.** The embeddings index is HNSW, which keeps recall on small catalogues; ivfflat with too few rows per list returns incomplete results.
10. **Federation baselines need scale.** With seed data, three baselines publish; the thresholds (3 deals, 2 firms) are constants in `lib/federation.ts`.
11. **Replay mode.** Without `ANTHROPIC_API_KEY` the agents (including the three cross-validation reviewers and the insight narrator) return deterministic output from the same inputs and schemas. The financial engine, Monte Carlo, valuation, backtest and federation are the same in both modes.
12. **Embeddings** are a local 1,536-dimension hashing embedding (no extra key); a hosted embedding model would match on meaning rather than vocabulary.
13. **One firm per user**, billing computed but not collected, brand fonts limited to Playfair Display and Inter.
14. **Demonstration mode is open.** Without Clerk every visitor acts as a demonstration persona, including on `/api/mcp` without a key; with Clerk configured an API key or a staff session is required.

## 6. Deployment (summary)

Full click-by-click instructions are in `README.md`.

1. GitHub: have the repository in your account.
2. Supabase: create a project (free tier works).
3. Switch on the `vector` extension.
4. Copy the project URL, anon key, service role key and transaction pooler connection string.
5. Clerk: create the application, enable Organizations, customise the session token.
6. Supabase trusts Clerk: Clerk → Integrations → Supabase; Supabase → Authentication → Third-Party Auth → Clerk.
7. Buckets: created automatically by setup (or by hand: documents, memos, branding, avatars, all private).
8. Anthropic: create an API key.
9. Vercel: import the repository, add the Clerk integration and the environment variables.
10. Deploy; add the Clerk webhook and redeploy.
11. Visit `/api/setup?secret=YOUR_SETUP_SECRET`: tables, RLS, storage, Realtime and seed data.
12. Clerk → your user → public metadata `{"role":"platform_admin"}`.
13. `/platform/tenants`: review PropFolios (or create a firm).
14. Send Amol the sign-up link for `amol@propfolios.ae`.

## 7. Screenshots

In `docs/screenshots`, production build, 1440 px wide (full page) unless noted, demonstration data, replay agents.

| File | Screen |
| --- | --- |
| 01-landing.jpg | Landing: hero, live preview, federation section |
| 02-pricing.jpg | Four plans |
| 03-onboarding.jpg | Self-serve firm onboarding |
| 04-sign-in.jpg | Sign-in |
| 05 to 09 | Platform: dashboard, tenants, tenant detail, create tenant, metrics |
| 10 to 15 | Firm administration: overview, users, branding, billing, audit log (filters, date range, export), demonstration data |
| 16-analyst-dashboard.jpg | Analyst dashboard with the insight feed and federation line |
| 17-mandates.jpg | Mandates board |
| 18 to 25 | Mandate tabs: overview, research, underwriting (valuation, federated baseline, scenarios, Monte Carlo, sensitivity), due diligence, debate with three-model cross-validation, memo, documents, audit |
| 26 to 32 | Create mandate, properties, property detail, developers, market (heatmap, signals with backtest, UAE versus India with checklist), clients, memos |
| 33 to 38 | Client portal: portfolio (live) with insights, opportunities, recommendations, documents with signature request, messages, assistant |
| 39, 40 | 390 px phone: landing, portfolio |
| 41-demo.jpg | Public demonstration after a run |
| 42-platform-federation.jpg | Federation console: baselines, consent, aggregation runs |
| 43-admin-integrations-mcp.jpg | Integrations, API keys and MCP connection |
| 44-admin-intelligence.jpg | Insight thresholds, payment instructions, federation consent |
| 45-mandate-actions.jpg | Actions tab: proposals, approve and reverse |
| 46-analyst-insights.jpg | Insights feed and follow-ups |
| 47-analyst-federation.jpg | Federated baselines for the firm's segments |
| 48-client-insights.jpg | Client insights |
