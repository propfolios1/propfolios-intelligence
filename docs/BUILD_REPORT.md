# PropFolios Intelligence: build report

Release v1.0 · branch `claude/adoring-brown-6qrqag` · 1 October 2026

## 1. Size

| Measure | Count |
| --- | --- |
| Files in the repository | 286 |
| Source files (TypeScript, TSX, CSS, SQL) | 246 |
| Lines of source | 16,390 |
| of which `app/` (pages and API routes) | 3,322 |
| of which `components/` | 6,505 |
| of which `lib/` (AI agents, prompts, orchestrator, queries, auth) | 4,312 |
| of which `db/` (schema, seed, seed data) | 1,818 |
| Pages | 32 |
| API route handlers | 28 |
| Database tables | 16 (pgvector HNSW index on documents) |
| AI agents | 12 (11 structured + streaming NL query) |
| Versioned prompts | 13 files, all `_v1` |

## 2. Build status

| Check | Result |
| --- | --- |
| `npm run type-check` (TypeScript strict) | Pass, 0 errors |
| `npm run lint` | Pass, 0 errors, 0 warnings |
| `npm run build` (Next.js production) | Pass |
| `npm test` (financial engine: IRR, XIRR against Excel, NPV, Monte Carlo, sensitivity) | 10 of 10 pass |
| Page sweep on the production server, admin and client personas | 30 pages, 0 browser errors |
| Mandate flow in the browser: Create Mandate, live SSE timeline, review, approve and deliver | Pass, about 20 seconds in replay mode |
| Memo PDF export | Pass, A4, two pages, HTTP 200 `application/pdf` |
| Assistant, five questions (portfolio, attention items, recommendations, Abu Dhabi market, mandates in review) | Pass, each answer cites its sources |
| Role isolation (client cannot reach analyst or admin areas; analyst cannot reach admin) | Pass, 404 |
| Seed idempotency (second run makes no changes) | Pass |

## 3. Known limitations

1. **Next.js 15, not 14.** The project uses Next.js 15.5 (App Router, React 19), the current supported line. Everything specified for 14 applies; route params are asynchronous.
2. **Model names.** `claude-sonnet-4-20250514` is deprecated by Anthropic. It remains the default to match the specification; set `ANTHROPIC_MODEL_PRIMARY=claude-sonnet-5-5` in Vercel to use the current model. "claude-haiku-4" maps to `claude-haiku-4-5`.
3. **Replay mode.** Without `ANTHROPIC_API_KEY`, agents return deterministic rule-based output from the same inputs and schemas. It demonstrates every flow, but the prose is templated rather than written by a model.
4. **Seed data is illustrative.** The thirty projects, developers and price ranges are real names with representative figures; RERA numbers, transactions, market series and client portfolios are synthetic.
5. **Developer catalogue.** Eighteen developers are seeded (the eight named UAE developers plus ten Indian developers needed for the ten India projects).
6. **Embeddings.** Document search uses a local 1,536-dimension hashing embedding stored in pgvector, so it needs no extra API key. It matches on vocabulary rather than meaning; swap in a hosted embedding model for semantic recall.
7. **Embedded database.** Without `DATABASE_URL` the app runs on in-memory PGlite, which resets when the server instance restarts. Neon is required for persistence.
8. **Long agent runs.** Each pipeline invocation works within a 300-second budget and persists after every stage; if a run would exceed it, the stream reports a pause and the browser resumes automatically. On the Vercel Hobby plan (60-second functions without Fluid Compute) live runs resume more often.
9. **Live streaming granularity.** The timeline is driven by the database (polled each second) so it works across serverless instances; character-level progress appears only when the stream and the run share an instance.
10. **PDF page numbers.** The PDF footer shows the mandate reference and version rather than "page x of y"; the react-pdf render callback does not run inside the Next.js server bundle.
11. **Not built, by instruction:** Python services, Docker, Redis, WhatsApp, payments, DocuSign and CRM integrations. Email digests are stored as preferences but not sent.

## 4. Deployment in ten steps

Full click-by-click instructions are in `README.md`.

1. Vercel → Add New → Project → import `propfolios-intelligence`; add `SETUP_SECRET`; Deploy.
2. Vercel → Storage → Create Database → Neon → Connect (sets `DATABASE_URL`).
3. Redeploy.
4. Visit `/api/setup?secret=YOUR_SETUP_SECRET` to create tables and load the demonstration data.
5. Clerk → create application, enable Organizations, copy keys into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`; add webhook `/api/webhooks/clerk` for `user.created` and set `CLERK_WEBHOOK_SECRET`.
6. Anthropic console → create API key → `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL_PRIMARY=claude-sonnet-5-5`).
7. Add `CRON_SECRET`; optionally connect Vercel Blob and add `NEXT_PUBLIC_MAPBOX_TOKEN`.
8. Redeploy.
9. Sign up as amol@propfolios.ae; the account links to the seeded administrator.
10. Create Mandate, watch the timeline, approve and deliver, download the PDF.

## 5. Monthly cost estimate

Assumes a boutique advisory: 40 mandates a month, 1,000 assistant questions, five to fifty clients.

| Item | Basis | Monthly (USD) |
| --- | --- | --- |
| Vercel Pro | One seat; needed for 300-second functions and team use | 20 |
| Neon Launch | 10 GB storage, autoscaling compute (Free tier works for the demonstration) | 19 |
| Clerk | Free up to 10,000 monthly active users | 0 |
| Vercel Blob | Under 5 GB of documents | 0 to 2 |
| Mapbox | Under 50,000 map loads | 0 |
| Anthropic, mandate pipeline | About USD 1.40 per mandate on Sonnet 4 pricing (six agent calls including bull, bear and judge) × 40 | 56 |
| Anthropic, assistant | About USD 0.01 per question on Haiku 4.5 × 1,000 | 10 |
| Anthropic, scheduled jobs | Daily portfolio scan and weekly developer scoring | 2 |
| **Total** | | **about 107 to 109** |

A demonstration deployment on the free tiers (Vercel Hobby, Neon Free, Clerk Free) with light AI use costs under USD 10 a month. Agent spend is visible per run in the audit log and in the 30-day figure on the dashboard.

## 6. Screenshots

All in `docs/screenshots`, captured at 1440 × 900 unless noted (some on the development server, which shows the small Next.js indicator at bottom left).

| File | Screen |
| --- | --- |
| 01-landing.jpg | Public landing page |
| 02-sign-in.jpg | Sign-in (demonstration personas) |
| 03-analyst-dashboard.jpg | Analyst dashboard: stat cards, pipeline, activity, alerts, market pulse |
| 04-mandates-board.jpg | Mandates kanban board |
| 05-create-mandate.jpg | Create Mandate |
| 06-mandate-overview.jpg | Mandate overview: recommendation, scenarios, live pipeline, risk radar |
| 07-mandate-research.jpg | Research dossier with citations and risks |
| 08-mandate-underwriting.jpg | Scenarios, cash flows, IRR distribution, sensitivity, assumptions |
| 09-mandate-due-diligence.jpg | Due Diligence Findings by severity |
| 10-mandate-debate.jpg | Bull, bear and judge |
| 11-mandate-memo.jpg | Allocation Memo editor with fact check and citations |
| 12-properties.jpg | Property catalogue |
| 13-property-detail.jpg | Property detail: comparables, market, developer risk |
| 14-developers.jpg | Developer risk scores |
| 15-market.jpg | Market intelligence and timing agent |
| 16-clients.jpg | Client list |
| 17-audit-log.jpg | Audit log with agent cost and tokens |
| 18-seed-data.jpg | Seed data administration |
| 19-client-portfolio.jpg | Client portfolio |
| 20-client-opportunities.jpg | Client opportunities |
| 21-client-recommendations.jpg | Client recommendations |
| 22-client-documents.jpg | Client documents with upload |
| 23-client-messages.jpg | Client and advisory team messages |
| 24-client-assistant.jpg | Assistant answering with citations |
| 25-mobile-mandates.jpg | Mandates on a 390px phone (vertical board) |
| 26-mobile-portfolio.jpg | Client portfolio on a 390px phone |
