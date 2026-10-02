# Nakhla: build report

Release v1.0 · branch `claude/adoring-brown-6qrqag` · 2 October 2026

Nakhla is a multi-tenant AI operating system for real estate advisory firms. Tenant number one is PropFolios.ae. It builds on the PropFolios Intelligence v1.0 codebase in the same repository.

## 1. Size

| Measure | Count |
| --- | --- |
| Files in the repository | 352 |
| Source files (TypeScript, TSX, CSS, SQL) | 295 |
| Lines of source | 20,338 |
| of which `app/` (pages and API routes) | 4,708 |
| of which `components/` | 7,590 |
| of which `lib/` (agents, prompts, orchestrator, auth, tenancy, plans, queries) | 5,381 |
| of which `db/` (schema, seed, seed data) | 2,046 |
| of which `drizzle/` (SQL migrations, including row-level security) | 550 |
| Pages | 44 |
| API route handlers | 36 |
| Database tables | 19, every tenant-owned table carrying `tenant_id` |
| Row-level security policies | 19 |
| AI agents | 12 |
| Versioned prompts | 15 files: thirteen `_v1`, plus `market-timing_v2` and `cross-border_v2` (v1 kept) |

## 2. Build status

| Check | Result |
| --- | --- |
| `npm run type-check` (TypeScript strict) | Pass, 0 errors |
| `npm run lint` | Pass, 0 errors, 0 warnings |
| `npm run build` (Next.js production) | Pass |
| `npm test` (financial engine: IRR, XIRR against Excel, NPV, Monte Carlo, sensitivity) | 10 of 10 pass |
| Page sweep on the production server, four personas (platform, firm administrator, analyst, client) | 43 pages, all HTTP 200, 0 browser errors |
| Three-tenant isolation (PropFolios, Gulf Crest Capital, Meridian Family Office): mandates, properties and clients disjoint; each tenant's mandates return 404 to the other two; a cross-tenant upload against another firm's mandate returns 404 | Pass |
| Plan enforcement: sixth seat on Starter returns 402; Starter branding returns 402; custom domain without White-label returns 402 | Pass |
| Self-serve onboarding: new firm created with trial subscription, administrator and demonstration data | Pass |
| Mandate flow over server-sent events: Intake, Research, Underwriting, Due Diligence, Debate, Memo, Review | Pass in replay mode |
| Memo PDF export in the tenant's house style (brand name, colours, sign-off, disclaimer) | Pass, HTTP 200 `application/pdf` |
| Seed idempotency: `/api/setup` run twice; second run reports no changes; wrong secret returns 401 | Pass |
| Migration on a database holding pre-Nakhla data: columns backfilled, `admin` role converted to `tenant_admin`, 19 policies created | Pass |

## 3. Known limitations and deviations

1. **Repository and branch.** The specification asks for a fresh repository named `nakhla-intel` pushed to `main`. This session can write only to `propfolios-intelligence` on branch `claude/adoring-brown-6qrqag`, so Nakhla is built there. Merge the branch to `main` (or import the branch in Vercel) to deploy.
2. **Next.js 15, not 14.** The project uses Next.js 15.5 (React 19), the current supported line. Route params are asynchronous; everything else specified for 14 applies.
3. **Model names.** `claude-sonnet-4-20250514` is deprecated by Anthropic. It remains the default to match the specification; set `ANTHROPIC_MODEL_PRIMARY=claude-sonnet-5-5` to use the current model. "claude-haiku-4" maps to `claude-haiku-4-5`.
4. **Row-level security is defence in depth.** Policies are enabled, not forced, so the table owner (the role the app connects as) bypasses them. Isolation is enforced in code: every query passes through `scope()` or `tenantDb()`, which throw when the tenant is missing. The policies protect any other database role, such as a reporting user.
5. **One firm per user.** A person belongs to one tenant. A platform administrator reaches other firms through **Open as administrator**; each visit is audited in that firm's log.
6. **Billing.** Plans, seats and custom-domain rights are enforced, and invoices with 5% VAT are computed and displayed, but no payment processor is connected.
7. **Brand fonts.** Firms choose Playfair Display or Inter for headings; other typefaces are not loaded.
8. **Replay mode.** Without `ANTHROPIC_API_KEY`, agents return deterministic, rule-based output from the same inputs and schemas. Every flow works, but the prose is templated. The market table's BUY, HOLD and SELL column uses this deterministic signal; the timing agent card runs the live agent.
9. **Embeddings.** pgvector comparables and document search use a local 1,536-dimension hashing embedding, so no extra key is needed. It matches on vocabulary rather than meaning.
10. **Rate limiting** is shared across servers only when Upstash or Vercel KV is connected; otherwise each instance limits in memory.
11. **Embedded database.** Without `DATABASE_URL` the app runs on in-memory PGlite, which resets on restart. Neon is required for persistence.
12. **Long agent runs** work within a 300-second budget and resume automatically; on Vercel Hobby (60-second functions) they resume more often.
13. **Not found pages under loading states** are served with status 200 and the not-found content, a Next.js streaming behaviour. No data is rendered.
14. **Seed data is illustrative.** Project and developer names are real; figures, transactions, clients and the three sample firms are synthetic.
15. **Not built, by instruction:** Python services, Docker, Redis beyond Upstash/KV, WhatsApp, DocuSign, CRM, mobile apps, a public API, fine-tuning, SOC 2 and multi-region hosting. Weekly digests are stored as messages, not emailed.

## 4. Deployment

Full click-by-click instructions are in `README.md`.

1. GitHub: confirm the repository is in your account.
2. Vercel: Add New → Project → import; add `SETUP_SECRET`; Deploy.
3. Neon: Vercel → Storage → Create Database → Neon → Connect.
4. Clerk: create the application, enable Organizations, customise the session token with `{"metadata": "{{user.public_metadata}}"}`, add the webhook for `user.created` and `user.updated`.
5. Anthropic: create an API key.
6. Environment variables: Clerk keys, webhook secret, Anthropic key, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`; optionally Blob, Upstash/KV, model override, Mapbox.
7. Redeploy.
8. Visit `/api/setup?secret=YOUR_SETUP_SECRET`.
9. Sign up, then in Clerk set your public metadata to `{"role":"platform_admin"}`; sign in again.
10. In `/platform`, review the PropFolios tenant (or create a firm with Tenants → Create tenant).
11. Send Amol the sign-up link for `amol@propfolios.ae`.

## 5. Monthly running cost

Per firm of about 40 mandates and 1,000 assistant questions a month: Anthropic about USD 68 (mandate pipeline USD 56, assistant USD 10, scheduled jobs USD 2). Shared platform cost: Vercel Pro USD 20, Neon Launch USD 19, Clerk free to 10,000 monthly users, Blob and Upstash within free tiers at low volume. Agent spend per firm appears in `/platform/metrics` and each firm's audit log.

## 6. Screenshots

In `docs/screenshots`, captured on the production build at 1440 × 900 (full page) unless noted, demonstration mode, replay agents.

| File | Screen |
| --- | --- |
| 01-landing.jpg | Nakhla landing page |
| 02-pricing.jpg | Pricing: four plans |
| 03-onboarding.jpg | Self-serve onboarding with live brand preview |
| 04-sign-in.jpg | Sign-in with demonstration personas |
| 05-platform-dashboard.jpg | Platform dashboard: MRR, ARR, firms, churn, AI cost |
| 06-platform-tenants.jpg | Tenant list |
| 07-platform-tenant-detail.jpg | Tenant detail: plan, status, feature switches, billing, open as administrator |
| 08-platform-new-tenant.jpg | Create tenant |
| 09-platform-metrics.jpg | Agent quality and cost by agent, tenant and model |
| 10-admin-dashboard.jpg | Firm administration overview |
| 11-admin-users.jpg | Users, seats and invitations |
| 12-admin-branding.jpg | Branding: logo, colours, fonts, memo house style, domain |
| 13-admin-billing.jpg | Plan, seats and invoices |
| 14-admin-audit.jpg | Audit log |
| 15-admin-seed.jpg | Demonstration data |
| 16-analyst-dashboard.jpg | Analyst dashboard |
| 17-mandates.jpg | Mandates board |
| 18-mandate-overview.jpg to 25-mandate-audit.jpg | Mandate tabs: Overview (with timeline), Research, Underwriting (scenarios, cash flow, risk radar, tornado), Due Diligence, Debate, Memo, Documents, Audit |
| 26-create-mandate.jpg | Create Mandate |
| 27-properties.jpg | Property catalogue |
| 28-property-detail.jpg | Property detail with ten pgvector comparables |
| 29-developers.jpg | Developer risk |
| 30-market.jpg | Market: heatmap, BUY/HOLD/SELL table, timing agent, UAE versus India |
| 31-clients.jpg | Clients |
| 32-memos.jpg | Memos |
| 33-client-portfolio.jpg to 38-client-assistant.jpg | Client portal: portfolio, opportunities, recommendations, documents, messages, assistant |
| 39-mobile-landing.jpg, 40-mobile-portfolio.jpg | 390 px phone (viewport only) |
