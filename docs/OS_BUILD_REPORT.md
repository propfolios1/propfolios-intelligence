# Nakhla vertical OS: build report

This report covers the extension of Nakhla from an intelligence platform into a full operating system for real estate advisory firms. It adds six modules, India, Deals, Commission, Client layer, Business intelligence and the OS fabric, on top of the mandate pipeline in `docs/BUILD_REPORT.md`. Nothing that existed before was removed. The figures below were measured on branch `claude/adoring-brown-6qrqag` at the final commit.

## Totals

| Measure | Value |
| --- | --- |
| Pages (App Router `page.tsx`) | **93** (90+ required) |
| API route handlers | 96 |
| Database tables | 66 (38 added by `drizzle/0005_full_os.sql`, 36 of them tenant-scoped) |
| Row-level security policies | **246** on 63 tables; 146 of them on the 38 new tables (four per tenant table; `benchmarks` and `data_products` are platform-wide and read-only) |
| Public tables without RLS | **0** (the 3 federation tables have RLS on and no policies, so they are closed to all client roles) |
| Agents | **45**: 13 mandate-pipeline agents plus 32 vertical-OS agents (numbered 14 to 45) |
| Versioned prompts | 69 files in `lib/ai/prompts`, including the seven required: `research_india_mumbai_v1`, `research_india_goa_v1`, `underwriting_india_v1`, `due_diligence_maharashtra_v1`, `due_diligence_goa_v1`, `tax_advisor_india_v1`, `nri_workflow_v1` |
| Event bus | 9 events, each starting 1 to 3 agents |
| MCP tools | 17 (6 original, 11 new) |
| Access roles | 11, with a 30-permission matrix |
| Interface languages | 5: English, Arabic (right to left), Hindi, Marathi, Konkani |
| Unit tests | 74 passing (Vitest), including a mock-LLM run of every OS agent |
| Code | 44,175 lines of TypeScript, CSS, SQL and scripts in the repository; the extension changed 279 files (+31,814 lines) |
| Build | `npm run type-check`, `npm run lint`, `npm test` and `npm run build` pass at every commit |

## Commits

| Commit | Module |
| --- | --- |
| `0df64f5` | India integration: MahaRERA, Goa RERA, Maharashtra and Goa rules engine |
| `b873665` | Deal execution: offers, negotiations, contracts, signatures |
| `a0f5588` | Commission layer: structures, splits, invoices, payments |
| `9e8e037` | Client layer: KYC, AML, reports, statements, tax documents |
| `db74cef` | Business intelligence: benchmarks, firm metrics, data products |
| `43f4880` | OS fabric: unified data model, RBAC, audit, automations, i18n |
| `2c55d70` | Seed expansion: Mumbai, Goa, deals, commissions |
| this commit | Documentation |

## Verification

All checks were run against PostgreSQL 16 after `/api/setup?reset=1`, with the production build (`npm start`).

| Check | Result |
| --- | --- |
| `npm install`, `type-check`, `lint`, `build` | Pass |
| 90+ pages render | 93 page routes built. A browser sweep of 80 concrete URLs (every page, with real ids for the dynamic ones) returned HTTP 200 with **no console errors** |
| iPhone 12 viewport (390 × 844) | All 80 URLs: no horizontal overflow, no console errors (four overflows found and fixed during this pass) |
| RLS cross-tenant test, every new table | `npm run verify:rls` signs in as PropFolios through Clerk-style JWT claims (`sub`, `org_id`, role `authenticated`) and tries to read, update, delete and insert Gulf Realty rows in **all 60 tenant tables**. Result: **PASSED**, no leaks. Tables that hold secrets (API keys, signing tokens, share links, email outbox) refuse client reads entirely |
| Mumbai stamp duty = 6% | Unit test: 5% stamp duty plus 1% metro cess; registration 1% capped at INR 30,000. Goa: 3.5%, and 2.5% when every buyer is a woman |
| Deal flow | Create, offer and accept, contract (SHA-256 hash), send for native signature. A wrong signer email returns 403 and a reused link returns 404. With 3 critical checklist items open, close is blocked (422). Then close; the events run 3, 2, 3, 2 and 2 agents |
| Commission flow | The close computes the commission (INR 580,000 at 2%), splits it 40/20/40, issues an India GST invoice (18%, INR 104,400), reconciles a bank CSV and marks the invoice paid |
| KYC flow | KYC analyzer, then AML screening (an adverse media alert), then documents verified and alerts dispositioned. Verification is refused (422) until every document is verified, then succeeds |
| BI across 3 tenants | Benchmarks computed in 8 categories from 3 firms. None is published, because publication needs 5 firms and 20 deals. Demonstration mode shows them labelled as indicative |
| An automation fires | On the seeded history, *Mumbai agreements: open the registration file* ran 3 times when Mumbai deals reached contract. *Closings above AED 3M* ran 3 times. Non-matching events are recorded as skipped (66) |
| Hindi switch translates the UI | With the locale cookie set to `hi`, navigation, breadcrumbs, page titles and shell controls render in Hindi (`डैशबोर्ड`, `सौदे`, `मेरे कमीशन`). Arabic sets `dir="rtl"` and mirrors the layout; Marathi and Konkani verified the same way |
| New MCP tools respond | All 11 return 200 through an API key; `tools/list` returns 17. An invalid key returns 401 (fixed during this pass: it previously fell back to the demonstration session) |
| Seed is idempotent | A second `/api/setup` changed no counts (deals 24, offers 36, commissions 15, invoices 9, events 96, consents 60) |
| Agent cost ceiling ($0.50 per run) | Per-run estimates for the OS agents come from prompt, tool schema and output size at each model tier, and range from $0.0014 to $0.015. The heaviest mandate-pipeline agent, debate (bull, bear and judge), is costed at $0.40 per run in the seeded pipeline history. Administration → AI control shows the live average per agent and flags any agent above $0.50 |

### Seeded data

| Required | Seeded (per firm × 3 firms) |
| --- | --- |
| 15 Mumbai and 10 Goa properties | 15 Mumbai and 12 Goa (55 properties and 23 developers per firm in total) |
| 4 deals | 4 live deals (Dubai closed, Mumbai in payment, Goa in negotiation, Abu Dhabi in signing), 3 historical closings, and the journey deal: 8 per firm, 24 in total |
| 8 offers | 12 per firm |
| 3 contracts with signatures | 4 per firm, every signature with time, IP address and contract hash |
| 12 commissions | 15 in total, with splits |
| 6 invoices | 9 in total (UAE VAT and India GST), 3 of them paid |
| 3 KYC records | 5 per firm |
| 5 client reports | 5 per firm, plus 15 monthly statements |
| Benchmarks in 8 categories | 8 categories, 40 benchmark rows |
| 3 automations | 3 per firm |
| Fabric | 20 consents per firm, 2 data subject requests, notification preferences, a mention. Across the three firms: 81 India project records, 66 RERA complaints and 27 land records |

## India data sources: real and mocked

The rules engine is real. Every statutory rate in `lib/regulations` is hand-coded from the current notification and unit tested: Maharashtra stamp duty, metro cess, local body tax and registration; Goa stamp duty and the women's concession; Dubai and Abu Dhabi transfer fees; TDS under s.194-IA and s.195.

The 19 government sources in `lib/india/sources.ts` are **mocked adapters**. Each returns realistic records from the seed, names the issuing authority and links to the official portal, so an analyst can verify any entry by hand. None of these portals publishes an API, and most sit behind captchas, so the adapters are the point where a licensed data feed would plug in.

| Source | Authority | Status |
| --- | --- | --- |
| MahaRERA | Maharashtra Real Estate Regulatory Authority | Mocked (seeded projects and complaints) |
| IGR Maharashtra, Index II | Inspector General of Registration | Mocked |
| Ready Reckoner | Department of Registration and Stamps | Mocked rates by zone (2026-27 values for the seeded micro-markets) |
| 7/12 extract (Bhulekh) | Revenue Department | Mocked lookup. **Uploaded 7/12 extracts are parsed for real** (English and Marathi, Devanagari digits) |
| Property card | City Survey Office | Mocked lookup; **uploads parsed for real** |
| CTS survey | City Survey Office | Mocked |
| Society records | Co-operative societies registrar | Mocked |
| MCGM building approvals | MCGM Building Proposals | Mocked |
| MHADA and SRA | MHADA, Slum Rehabilitation Authority | Mocked |
| DCPR 2034 | MCGM | Rules engine (FSI, premium FSI, TDR, fungible area) is real; site data is mocked |
| Goa RERA | Goa RERA | Mocked |
| Goa registration | Inspector General of Registration, Goa | Mocked |
| Land use and conversion (s.32 sanad) | Collector, Town and Country Planning | Mocked |
| Regional Plan 2021 | Town and Country Planning | Zone rules are real; plot zoning is mocked |
| Comunidade | Administrator of Comunidades | Mocked lookup; **uploaded comunidade documents are parsed for real** |
| Mundkar register | Mamlatdar | Mocked |
| Form I and XIV | Directorate of Settlement and Land Records | Mocked lookup; **uploads parsed for real** |
| CRZ | Goa Coastal Zone Management Authority | CRZ rules are real; plot classification is mocked |
| Escritura | Archives of Goa | Mocked |

Text is extracted from uploaded PDFs with `unpdf`. Scanned images are read by Claude when `ANTHROPIC_API_KEY` is set.

## What runs without which key

| Missing | Behaviour |
| --- | --- |
| `ANTHROPIC_API_KEY` | Every agent replays deterministically. The schemas, engines, memory and audit are the same; the cost is recorded as $0 |
| `RESEND_API_KEY` | Emails are kept in the outbox with status *not configured*; in-app notifications still arrive |
| `DROPBOX_SIGN_API_KEY` | Native signature: a one-time link per signer, typed name, explicit consent, IP address, user agent and a SHA-256 hash of the contract |
| Clerk keys | Demonstration mode with persona switching |
| `DATABASE_URL` | An embedded PGlite database migrates and seeds itself (demonstration only) |

## Limitations

- **India sources are mocked**, as listed above. The adapters and their interface are ready for licensed feeds.
- **AML screening uses a mock provider.** It labels its results "Nakhla Screening (mock)", and its decisions must not be relied on for compliance until a licensed screening provider is connected.
- **Live AI costs were not measured here.** The build environment has no Anthropic key, so the costs of the OS agents are estimates from prompt and output size. The first live runs replace the estimates on the AI control page.
- **Translation covers the interface shell only:** navigation, breadcrumbs, page titles, notifications and controls. Body copy, reports and agent output stay in English. Arabic is right to left, with figures kept left to right.
- **Automation actions** cover team notification, email, tasks, reports and Slack webhooks. There is no SMS or WhatsApp, as the brief excludes it.
- **Dropbox Sign** was implemented against its published API and webhook format, but was not exercised against a live account from this environment. The native signature path was tested end to end.
- **Benchmarks** stay unpublished until five consenting firms and twenty observations exist. With the three seeded firms, real deployments show "not yet published" outside demonstration mode, which is the intended privacy behaviour.
- **Vercel Hobby** runs each cron at most once a day and stops functions at 60 seconds. Long agent chains resume on the next request; Vercel Pro is recommended.

## Deploy, for a first-time operator (14 steps)

Everything happens in a web browser. The README has the same steps with more detail and a troubleshooting guide.

1. **GitHub.** Sign in and make sure the `propfolios-intelligence` repository is in your account (use **Fork** if it was shared with you).
2. **Supabase project.** At supabase.com, click **New project**, name it `nakhla`, generate a database password and save it, choose the Mumbai or Frankfurt region, and click **Create**.
3. **pgvector.** Supabase → **Database → Extensions**; switch on `vector`.
4. **Supabase keys.** **Project Settings → API**: copy the Project URL, the anon key and the service_role key. Under **Connect → Transaction pooler**, copy the connection string and put your password in it. This is `DATABASE_URL`.
5. **Clerk.** At clerk.com, create an application named Nakhla and copy both keys. Under **Configure → Organizations**, enable organisations. Under **Sessions → Customize session token**, add `{ "metadata": "{{user.public_metadata}}", "role": "authenticated" }`.
6. **Let Supabase trust Clerk.** Supabase → **Authentication → Third-party auth → Add Clerk**, and paste your Clerk domain.
7. **Anthropic.** At console.anthropic.com, create an API key and add credit.
8. **Optional: Resend.** At resend.com, verify your domain under **Domains** and create an API key. Choose a sender address on that domain.
9. **Optional: Dropbox Sign.** Copy the API key from **API settings**. Keep test mode on until you are ready.
10. **Vercel.** At vercel.com, **Add New → Project** and import the repository. Add the environment variables from `.env.example`: the Supabase four, both Clerk keys, `ANTHROPIC_API_KEY`, `SETUP_SECRET`, `CRON_SECRET` and `NEXT_PUBLIC_APP_URL`, plus `RESEND_API_KEY`, `RESEND_FROM`, `DROPBOX_SIGN_API_KEY` and `DROPBOX_SIGN_TEST_MODE` if you use them. Click **Deploy**.
11. **Webhooks.** In Clerk → **Webhooks**, add `https://YOUR-SITE/api/webhooks/clerk` (events `user.created` and `user.updated`), copy the signing secret into Vercel as `CLERK_WEBHOOK_SECRET`, and redeploy. If you use Dropbox Sign, set its account callback to `https://YOUR-SITE/api/webhooks/dropbox-sign`.
12. **Create the database.** Open `https://YOUR-SITE/api/setup?secret=YOUR_SETUP_SECRET`. It should show `"ok": true`. This creates the 66 tables, the 246 security policies, the storage buckets and all the starting data. Running it again changes nothing.
13. **Make yourself platform administrator.** Sign up on your site. In Clerk → **Users** → your name → **Public metadata**, set `{ "role": "platform_admin" }`, then sign out and back in.
14. **Hand over the workspace.** Send Amol the sign-up link and tell him to register with `amol@propfolios.ae`. He lands in the PropFolios workspace with deals, commissions, KYC files, reports and the India desk ready. Languages are chosen at the foot of the sidebar.

## Screenshots

Desktop screenshots are 1440 pixels wide, full page. Mobile screenshots use the iPhone 12 viewport (390 × 844). Screenshots 01 to 48 cover the platform and are listed in `docs/BUILD_REPORT.md`. The 64 below cover the vertical OS; with the five mobile screenshots, this report holds 69.

| No. | Screen | File |
| --- | --- | --- |
| 46 | Analyst insights | [`46-analyst-insights.jpg`](screenshots/46-analyst-insights.jpg) |
| 47 | Analyst federation | [`47-analyst-federation.jpg`](screenshots/47-analyst-federation.jpg) |
| 48 | Client insights | [`48-client-insights.jpg`](screenshots/48-client-insights.jpg) |
| 49 | India overview | [`49-india-overview.jpg`](screenshots/49-india-overview.jpg) |
| 50 | Mumbai projects | [`50-mumbai-projects.jpg`](screenshots/50-mumbai-projects.jpg) |
| 51 | Mumbai maharera | [`51-mumbai-maharera.jpg`](screenshots/51-mumbai-maharera.jpg) |
| 52 | Mumbai ready reckoner | [`52-mumbai-ready-reckoner.jpg`](screenshots/52-mumbai-ready-reckoner.jpg) |
| 53 | Mumbai dcpr | [`53-mumbai-dcpr.jpg`](screenshots/53-mumbai-dcpr.jpg) |
| 54 | Goa projects | [`54-goa-projects.jpg`](screenshots/54-goa-projects.jpg) |
| 55 | Goa comunidade | [`55-goa-comunidade.jpg`](screenshots/55-goa-comunidade.jpg) |
| 56 | Tax calculator | [`56-tax-calculator.jpg`](screenshots/56-tax-calculator.jpg) |
| 57 | India record mumbai | [`57-india-record-mumbai.jpg`](screenshots/57-india-record-mumbai.jpg) |
| 58 | India record goa | [`58-india-record-goa.jpg`](screenshots/58-india-record-goa.jpg) |
| 59 | Client india | [`59-client-india.jpg`](screenshots/59-client-india.jpg) |
| 60 | Client nri | [`60-client-nri.jpg`](screenshots/60-client-nri.jpg) |
| 61 | Deals list | [`61-deals-list.jpg`](screenshots/61-deals-list.jpg) |
| 62 | Deals board | [`62-deals-board.jpg`](screenshots/62-deals-board.jpg) |
| 63 | Deal overview | [`63-deal-overview.jpg`](screenshots/63-deal-overview.jpg) |
| 64 | Deal offers | [`64-deal-offers.jpg`](screenshots/64-deal-offers.jpg) |
| 65 | Deal negotiations | [`65-deal-negotiations.jpg`](screenshots/65-deal-negotiations.jpg) |
| 66 | Deal contracts | [`66-deal-contracts.jpg`](screenshots/66-deal-contracts.jpg) |
| 67 | Deal checklist | [`67-deal-checklist.jpg`](screenshots/67-deal-checklist.jpg) |
| 68 | Deal payments | [`68-deal-payments.jpg`](screenshots/68-deal-payments.jpg) |
| 69 | Deal audit | [`69-deal-audit.jpg`](screenshots/69-deal-audit.jpg) |
| 70 | Client deals | [`70-client-deals.jpg`](screenshots/70-client-deals.jpg) |
| 71 | Client deal | [`71-client-deal.jpg`](screenshots/71-client-deal.jpg) |
| 72 | Admin commissions | [`72-admin-commissions.jpg`](screenshots/72-admin-commissions.jpg) |
| 73 | Commission structures | [`73-commission-structures.jpg`](screenshots/73-commission-structures.jpg) |
| 74 | Admin invoices | [`74-admin-invoices.jpg`](screenshots/74-admin-invoices.jpg) |
| 75 | Tax returns | [`75-tax-returns.jpg`](screenshots/75-tax-returns.jpg) |
| 76 | Invoice detail | [`76-invoice-detail.jpg`](screenshots/76-invoice-detail.jpg) |
| 77 | Analyst commissions | [`77-analyst-commissions.jpg`](screenshots/77-analyst-commissions.jpg) |
| 78 | Client invoices | [`78-client-invoices.jpg`](screenshots/78-client-invoices.jpg) |
| 79 | Admin kyc | [`79-admin-kyc.jpg`](screenshots/79-admin-kyc.jpg) |
| 80 | Kyc file | [`80-kyc-file.jpg`](screenshots/80-kyc-file.jpg) |
| 81 | Admin reports | [`81-admin-reports.jpg`](screenshots/81-admin-reports.jpg) |
| 82 | Client reports | [`82-client-reports.jpg`](screenshots/82-client-reports.jpg) |
| 83 | Client statements | [`83-client-statements.jpg`](screenshots/83-client-statements.jpg) |
| 84 | Client goals | [`84-client-goals.jpg`](screenshots/84-client-goals.jpg) |
| 85 | Client tax documents | [`85-client-tax-documents.jpg`](screenshots/85-client-tax-documents.jpg) |
| 86 | Client private banking | [`86-client-private-banking.jpg`](screenshots/86-client-private-banking.jpg) |
| 87 | Platform bi | [`87-platform-bi.jpg`](screenshots/87-platform-bi.jpg) |
| 88 | Federation dashboard | [`88-federation-dashboard.jpg`](screenshots/88-federation-dashboard.jpg) |
| 89 | Analyst benchmarks | [`89-analyst-benchmarks.jpg`](screenshots/89-analyst-benchmarks.jpg) |
| 90 | Market reports | [`90-market-reports.jpg`](screenshots/90-market-reports.jpg) |
| 91 | Data products | [`91-data-products.jpg`](screenshots/91-data-products.jpg) |
| 92 | Client market insights | [`92-client-market-insights.jpg`](screenshots/92-client-market-insights.jpg) |
| 93 | Compliance requests | [`93-compliance-requests.jpg`](screenshots/93-compliance-requests.jpg) |
| 94 | Compliance consents | [`94-compliance-consents.jpg`](screenshots/94-compliance-consents.jpg) |
| 95 | Compliance retention | [`95-compliance-retention.jpg`](screenshots/95-compliance-retention.jpg) |
| 96 | Compliance quality | [`96-compliance-quality.jpg`](screenshots/96-compliance-quality.jpg) |
| 97 | Compliance audit | [`97-compliance-audit.jpg`](screenshots/97-compliance-audit.jpg) |
| 98 | Automations | [`98-automations.jpg`](screenshots/98-automations.jpg) |
| 99 | Ai control | [`99-ai-control.jpg`](screenshots/99-ai-control.jpg) |
| 100 | Users access roles | [`100-users-access-roles.jpg`](screenshots/100-users-access-roles.jpg) |
| 101 | Notifications | [`101-notifications.jpg`](screenshots/101-notifications.jpg) |
| 102 | Notifications mentions | [`102-notifications-mentions.jpg`](screenshots/102-notifications-mentions.jpg) |
| 103 | Notifications preferences | [`103-notifications-preferences.jpg`](screenshots/103-notifications-preferences.jpg) |
| 104 | Ai memory | [`104-ai-memory.jpg`](screenshots/104-ai-memory.jpg) |
| 105 | Mandate journey | [`105-mandate-journey.jpg`](screenshots/105-mandate-journey.jpg) |
| 106 | Platform agents | [`106-platform-agents.jpg`](screenshots/106-platform-agents.jpg) |
| 107 | Locale ar | [`107-locale-ar.jpg`](screenshots/107-locale-ar.jpg) |
| 107 | Locale hi | [`107-locale-hi.jpg`](screenshots/107-locale-hi.jpg) |
| 107 | Locale kok | [`107-locale-kok.jpg`](screenshots/107-locale-kok.jpg) |

Mobile (iPhone 12):

| Screen | File |
| --- | --- |
| Notifications mentions | [`m-102-notifications-mentions.jpg`](screenshots/m-102-notifications-mentions.jpg) |
| Mandate journey | [`m-105-mandate-journey.jpg`](screenshots/m-105-mandate-journey.jpg) |
| Locale mr | [`m-107-locale-mr.jpg`](screenshots/m-107-locale-mr.jpg) |
| Compliance requests | [`m-93-compliance-requests.jpg`](screenshots/m-93-compliance-requests.jpg) |
| Ai control | [`m-99-ai-control.jpg`](screenshots/m-99-ai-control.jpg) |
