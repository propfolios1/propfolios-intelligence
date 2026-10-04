# Nakhla: production readiness report

Prepared 4 October 2026 for the production build, features F1 to F22, on branch `claude/adoring-brown-6qrqag`.

This report states what is built, what has been verified and how, what depends on third-party credentials that were not available during the build, and what remains. Where something has not been tested against a live service, it says so.

---

## 1. Summary

Nakhla is now a multi-tenant operating system for real estate brokerages in six markets. It covers leads, listings, portal syndication, AI lead response, deals, commission, compliance, contracts, team analytics, marketing, developer inventory, client market intelligence and enterprise controls. The public site has also been rebuilt: homepage, pricing, FAQ, security, documentation and four segment pages.

| Check | Result |
| --- | --- |
| `npm run type-check` | Passes |
| `npm run lint` | Passes, no warnings |
| `npm test` | 303 tests in 36 files, all passing |
| `npm run build` | Passes |
| Fresh seed on Postgres | Completes in about 20 seconds. Seven brokerages plus the platform, trial and cancelled demonstration firms. |
| Embedded seed (PGlite, no database configured) | Completes without deadlock |
| Re-running setup | Idempotent. Lead and deal totals are unchanged on a second run. |
| Row-level security | 500 policies, and RLS enabled on 131 of 131 tables in the `public` schema (counted on the migrated database) |
| Screenshots | 134 in `docs/screenshots/production/` |

## 2. Counts

| Item | Count |
| --- | --- |
| TypeScript and TSX files | 991 |
| Lines of TypeScript | 78,819 |
| SQL migrations | 24 files (0000 to 0023), 3,607 lines |
| API route handlers | 193 |
| Pages | 164 |
| React components | 211 |
| Library modules | 310 |
| Supabase Edge Functions (job relays) | 15 |
| Scheduled jobs (Supabase Cron) | 17 |
| Tables in `public` | 131, all with RLS |
| RLS policies in `public` | 500 |
| Tests | 303 |
| Demonstration brokerages | 7 (plus platform, trial and cancelled firms) |

The RLS figures are not hard-coded anywhere public. `/api/stats` and `/security` read them from `pg_policies` and `pg_class` on the live database.

## 3. Features delivered in this build (F1 to F22)

| Feature | Commit | Highlights |
| --- | --- | --- |
| F1 Migration tool | earlier | Follow Up Boss, Salesforce/Propertybase, HubSpot, Zoho, kvCORE and CSV. Field mapping, dry run, import, 24-hour rollback. |
| F2 to F5 | earlier | Self-serve trials with market-seeded workspaces, portal publishing, firm websites, PWA agent app |
| F6 WhatsApp | 854914b | Inbox, templates, broadcasts with STOP handling, lead threads |
| F7 Lead response | bb6624f | Replies in seconds; qualifies; books viewings from calendars; hands over to agents; inbound email; ICS feeds |
| F8 Commission calculator | 5607c41 | Exact to the minor unit (BigInt). Presets, scenarios, append-only calculation history. |
| F9 Compliance centre | 2d809bc | Screening (OpenSanctions), KYC by jurisdiction, goAML XML, FINnet CSV, monitoring job |
| F10 Contracts | 3863cd2 | Safe template language, templates modelled on official forms, versioning, PDF, signature gate |
| F11 Team performance | 7912f04 | Metrics, medians, leaderboards, coaching flags, CSV export, nightly snapshots |
| F12 Marketing automation | be57d5d | Audiences, email and WhatsApp sequences, listing promotion, social publishing |
| F13 Developer inventory | 40de7ff | Feed, JSON, upload and sandbox connections. Change detection, buyer matching. |
| F14 Client market intelligence | d043aa2 | Subscriptions, weekly, fortnightly or monthly briefs, portal and email delivery |
| F15 Enterprise controls | c9dabf0 | SSO (SAML/OIDC, DNS verification, Clerk), SCIM 2.0, custom roles, scoped and rate-limited API keys, signed audit export, data residency |
| F16 Security page | af15e96 | Live RLS figures, honest compliance status, sub-processors, disclosure policy, `security.txt` |
| F17 Pricing | ceb27c1 | AED 1,500 / 8,000 / 25,000 / 50,000, six currencies, 20% annual discount, gates enforced in the API |
| F18 FAQ | acb1938 | Twelve questions, accessible accordion, FAQPage JSON-LD |
| F19 Docs | f261242 | Seventeen native guides, OpenAPI 3.1 reference. Adds signed outbound webhooks. |
| F20 Segment pages | 21c1fd2 | Four firm sizes. New header (Product, Solutions, Pricing, Docs) and footer. |
| F21 Homepage | 2e964c2 | Eighteen sections; Start free trial everywhere; no customer named |
| F22 Seed and this report | this commit | Seven brokerages via `seedMarketWorkspace`; offset references and name reuse for existing firms |

## 4. What is real, and what is simulated or untested

"Real" means the code calls the actual service's documented API or protocol. "Verified" says how it was checked during the build.

| Area | Implementation | Verified | Notes |
| --- | --- | --- | --- |
| Database, RLS, storage | Supabase Postgres, row-level security, storage policies | Migrations run locally; RLS tested under a restricted role with JWT claims | Production project not available during the build |
| Supabase Cron | pg_cron schedules, relayed through Edge Functions to `/api/jobs/*` | Schedules installed locally; handlers unit-tested | Edge Functions deploy through the provided GitHub Action or the Supabase CLI |
| Authentication | Clerk (sessions, organisations, webhooks) | Demonstration mode exercised; Clerk mode not run live | |
| SSO | SAML metadata parsing, X.509 checks and DNS TXT verification are real. Connections are created through Clerk's `saml_connections` API. | Parsing, certificates and DNS logic tested; the Clerk call tested against a stub | Not tested against a live Clerk instance or IdP |
| SCIM 2.0 | Implemented in full for Users | Tested against the database | Not tested with Okta or Entra ID provisioning |
| AI agents | Anthropic Messages API. Without a key, deterministic replay agents with the same schemas. | Replay path tested; live path not run during the build | |
| Lead response | Deterministic extraction and policy, with a model reply inside a 6-second budget | About 0.1 s locally on the deterministic path | Live latency depends on the model |
| Email | Resend REST API; outbox recorded when not configured | Outbox path tested | |
| WhatsApp | Meta Cloud API, Twilio and 360dialog adapters | Webhook parsing and dispatch tested | Needs a WhatsApp Business account; untested live |
| Portals | Partner APIs (REST, Rightmove RTDF over mTLS, Zoopla), XML feeds, sandbox | Sandbox and feed generation tested | Needs each portal's partner credentials; untested live |
| Developer inventory | Feed URL, JSON API and upload are real HTTP and parsing; sandbox for demonstration | Parsing and change detection tested | None of the listed developers publishes an open inventory API. Feeds come from their broker programmes. |
| Social publishing | Facebook, Instagram, LinkedIn, X and TikTok APIs; sandbox | Payload construction and limits tested | Needs app review and tokens from each network; untested live |
| CRM migration | Follow Up Boss, Salesforce, HubSpot, Zoho and kvCORE APIs; CSV | CSV path and mapping tested | API connectors untested live |
| Sanctions screening | OpenSanctions match API | Matching logic tested with the labelled sample list | Without `OPENSANCTIONS_API_KEY`, a small sample list is used for demonstration only. "Kyonis" could not be verified as a provider, so it was not integrated. |
| Regulator reports | goAML XML (UAE FIU), FINnet CSV (FIU-IND), narratives for NCA (UK) and STRO (Singapore) | Generated and checked in tests | Files are prepared for the MLRO to review and file. Nakhla does not submit them. |
| E-signature | Dropbox Sign API and native signing | Native path tested | Dropbox Sign untested live |
| Billing | Stripe Checkout over REST; webhook signature verification | Signature logic tested | Untested against live Stripe |
| Currency rates | ECB reference rates via Frankfurter (no key); AED from its 3.6725 dollar peg; labelled fallback table | Parsing and fallback tested | Frankfurter was blocked by the build sandbox's egress policy, so the live call is untested. exchangerate.host now requires a key and was not used. |
| Outbound webhooks | HMAC-SHA256 signatures, backoff retries, auto-pause | Tested end to end against a stub receiver | |
| Market data | Seeded monthly statistics per market | n/a | Demonstration data, not transaction feeds |
| Mobile app | PWA. Capacitor configuration for store builds. | PWA verified in the browser | Store builds need Xcode or Android Studio |
| Contract templates | Modelled on Form A, B and F, the MahaRERA agreement for sale, and UK and Singapore forms | Rendering tested | These are not the official forms themselves. The firm's lawyers should approve them. |

## 5. Scheduled jobs (Supabase Cron)

Vercel Cron is not used: the former `/api/cron/*` routes, `lib/cron.ts` and the `vercel.json` schedules have been removed. Each HTTP job is scheduled by pg_cron and calls a Supabase Edge Function of the same name through pg_net. That function relays to `/api/jobs/<job>` with `NAKHLA_JOBS_SECRET` and an idempotency key.

| Job | Schedule (UTC) | Purpose |
| --- | --- | --- |
| keep-alive | `0 */6 * * *` | Keeps a free-tier project from pausing (SQL) |
| job-run-details-cleanup | `0 0 * * *` | Deletes pg_cron history older than seven days (SQL) |
| trial-lifecycle | `0 * * * *` | Trial notices, read-only on day 14, soft delete on day 30, purge on day 60 |
| developer-sync | `0 */6 * * *` | Developer feeds and APIs |
| portal-publish-poll | `*/15 * * * *` | Portal publishing queue and status |
| proactive-insights | `0 * * * *` | Insight agent across active firms |
| federation-aggregate | `0 2 * * *` | Anonymised benchmarks from opted-in firms |
| whatsapp-dispatch | `* * * * *` | Throttled WhatsApp sends and broadcasts |
| webhook-dispatch | `* * * * *` | Signed webhook deliveries and retries |
| marketing-dispatch | `*/5 * * * *` | Sequences, listing promotion and social posts |
| client-market-briefs | `20 * * * *` | Client market briefs when due |
| compliance-monitoring | `30 1 * * *` | Re-screening, KYC expiry, report deadlines, retention |
| team-snapshots | `15 0 * * *` | Agent metrics and coaching flags |
| client-servicing | `0 3 * * *` | Statements, reports and goals |
| portfolio-monitor | `0 4 * * *` | Holdings monitoring and alerts |
| developer-risk | `0 5 * * 1` | Developer risk rescoring |
| bi-nightly | `0 23 * * *` | Firm metrics and market reports |

## 6. Demonstration data

Seven brokerages are seeded by `seedMarketWorkspace` (`db/seed-workspaces.ts`). Each gets three agents with history, 30 listings, 50 leads, five clients with holdings, ten deals across the pipeline, three commission records, two automations, one journey from mandate to paid commission invoice, and ninety days of market data.

| Firm | Market | Plan | Notes |
| --- | --- | --- | --- |
| Nakhla Demo Brokerage | UAE | Professional | Also carries the full advisory demonstration (mandates, memos, debates) |
| Sample Realty Dubai | UAE | Professional | |
| Demo Properties India | India | Professional | |
| London Prime Brokers | United Kingdom | Professional | |
| Singapore Luxury Homes | Singapore | Starter | |
| Sydney Harbour Realty | Australia | Professional | New in F22 |
| Manhattan Premier | United States | Enterprise | New in F22 |

Firms seeded by earlier releases keep their records. New references are offset (LS-0501, LD-0101 and so on), and agents, developers and clients with the same name are reused rather than duplicated. All people and firms are invented, and every email address is on a reserved example domain or `demo.nakhla.ai`. No real customer is named on the public site.

## 7. Known limitations

1. **Third-party connectors are untested live.** Portals, social networks, WhatsApp providers, CRM APIs, developer feeds, Dropbox Sign, Stripe and the Clerk SAML API all need partner credentials that were not available. Each is built to the provider's published API and tested against stubs.
2. **SOC 2.** The audit we planned for the second quarter of 2026 has not started, and Nakhla holds no SOC 2 report or other certification. The security page says so.
3. **No penetration test yet.** It is listed as planned, not done.
4. **Regulators and retention.** India's AML reports go to FIU-IND (not the RBI). UK estate agents are supervised by HMRC, but SARs go to the National Crime Agency. Singapore agents are supervised by the CEA, with STRO receiving reports. The seven-year retention exceeds the five-year statutory minimums in these regimes, and the firm may shorten it where the law allows.
5. **Sanctions data.** Without an OpenSanctions key, screening uses a small labelled sample list that is not fit for compliance decisions.
6. **Currency rates.** The live Frankfurter call could not be tested from the build environment. If the service is unreachable, pricing shows the labelled fallback rates.
7. **SCIM deviations.** DELETE deactivates the user instead of removing them, so a later GET returns the user with `active: false` rather than 404. Groups endpoints and bulk operations are not offered; roles map through the `roles` attribute or group names on custom roles.
8. **Data residency.** Moving a firm to another region is a scheduled operation run by the platform team, not a switch. Supabase's hosted service has no UAE region, so in-country UAE storage needs a dedicated deployment. AI requests are processed in the United States in every case.
9. **Rate limits.** Without Upstash or Vercel KV, API rate limits are counted per server instance.
10. **Webhook destinations.** Hostnames on private ranges are refused when an endpoint is registered. A hostname that later resolves to a private address is not re-checked at send time.
11. **Supabase secret keys.** New-format `sb_secret_` keys are not JWTs. The Edge Function relay compares the bearer value with `SUPABASE_SERVICE_ROLE_KEY`, so set the same value pg_cron sends.
12. **Mobile store builds** need Xcode or Android Studio; the PWA works without them.
13. **Contract templates** are modelled on the official forms, not copies of them.
14. **Plan gating** is enforced on write APIs. Pages stay readable on lower plans and show an upgrade notice.
15. **Demonstration data** (market statistics, firms, people) is synthetic.

## 8. Cost model (estimates)

These are estimates for planning, at list prices as understood at the time of writing. Confirm current prices with each provider before quoting.

**Fixed platform costs per month**

| Service | Plan | Approximate cost |
| --- | --- | --- |
| Supabase | Pro, with a larger compute add-on as tenants grow | USD 25 plus compute (USD 50 to 200 for the first 50 firms) |
| Vercel | Pro | USD 20 per team member |
| Clerk | Pro | USD 25, plus USD 0.02 per monthly active user above 10,000. Enterprise SSO connections are priced separately; check Clerk's current pricing. |
| Resend | Pro | USD 20 for 50,000 emails |
| Upstash Redis | Pay as you go | Under USD 10 at this scale |
| OpenSanctions | Commercial licence | Required for commercial use; quoted by OpenSanctions |

**Variable costs per firm per month**

| Driver | Assumption | Estimate |
| --- | --- | --- |
| AI lead replies | 1,000 enquiries, four replies each, about 3,000 input and 250 output tokens per reply on Claude Sonnet (USD 3 / 15 per million tokens) | About USD 50 |
| Agent runs (descriptions, briefs, research) | 300 runs at about USD 0.05 | About USD 15 |
| WhatsApp | Meta's per-message charges, by country and message category | Billed by Meta to the firm |
| Card payments | Stripe's fee in the firm's country | Deducted at payout |

Against a Starter price of AED 1,500 (about USD 408) a month, a typical small firm's variable cost is roughly USD 70, leaving a healthy gross margin. Heavy AI use is visible per run in the audit log and can be capped under AI control.

## 9. Deployment in twenty steps

Everything below is done in web consoles. No terminal is needed.

1. In Supabase, create a project in the region where the firm's data should live (for example `eu-central-1` or `ap-south-1`).
2. In Supabase, under Database, Extensions, enable `pg_cron`, `pg_net` and `vector`.
3. Copy the project URL, the anon (publishable) key, the service role (secret) key, and the transaction pooler connection string (port 6543).
4. In Clerk, create an application, turn on Organizations, and note the publishable and secret keys.
5. In Supabase, under Authentication, Third-party auth, add Clerk as a provider so Supabase accepts Clerk session tokens.
6. In Clerk, add a webhook to `https://<your-domain>/api/webhooks/clerk` and note its signing secret.
7. In Vercel, import the GitHub repository.
8. In Vercel, add the environment variables from `.env.example`. At minimum set: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, the Clerk keys, `CLERK_WEBHOOK_SECRET`, `SETUP_SECRET`, `NAKHLA_JOBS_SECRET`, `NAKHLA_ENCRYPTION_KEY`, `NEXT_PUBLIC_APP_URL` and `NAKHLA_DATA_REGION`.
9. Add `ANTHROPIC_API_KEY` for live agents. Without it, the deterministic replay agents run.
10. Add `RESEND_API_KEY` and `RESEND_FROM`, and verify the sending domain in Resend.
11. Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. Point a Stripe webhook at `/api/webhooks/stripe`.
12. Add `OPENSANCTIONS_API_KEY` before relying on screening.
13. Optionally add Upstash Redis (shared rate limits), the VAPID keys (push notifications) and `AUDIT_EXPORT_SECRET`.
14. Deploy in Vercel.
15. Open `https://<your-domain>/api/setup?secret=<SETUP_SECRET>`. This applies migrations, creates storage buckets, installs the Supabase Cron schedules and seeds the demonstration data. Add `&reset=1` only on an empty project.
16. In GitHub, under the repository's Settings, Secrets and variables, Actions, add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`.
17. In GitHub Actions, run "Deploy Supabase edge functions" once to deploy the fifteen job relays.
18. In Supabase, under Edge Functions, Secrets, set `NAKHLA_APP_URL` and `NAKHLA_JOBS_SECRET` (the same value as in Vercel).
19. Check Administration, System health: the database, storage, cron schedules and last job runs should all show as healthy.
20. Sign in, create the first firm (or use the seeded ones), and run through the security checklist below before inviting clients.

## 10. Security checklist before launch

- [ ] `SETUP_SECRET`, `NAKHLA_JOBS_SECRET`, `NAKHLA_ENCRYPTION_KEY`, `FEED_SECRET` and `AUDIT_EXPORT_SECRET` are long random values, different from each other, and stored only in Vercel and Supabase.
- [ ] The service role key appears only in server-side environment variables and Edge Function secrets, never in a `NEXT_PUBLIC_` variable.
- [ ] `/api/stats` shows every table under row-level security.
- [ ] The RLS isolation tests pass (`tests/rls-isolation.test.ts`).
- [ ] Clerk enforces multi-factor authentication for administrators.
- [ ] A break-glass administrator exists outside any enforced SSO domain.
- [ ] Storage buckets are private, and files are served only through signed URLs.
- [ ] Stripe, Clerk, Dropbox Sign and WhatsApp webhooks are configured with their signing secrets.
- [ ] Rate limiting uses Upstash or Vercel KV in production.
- [ ] Backups and point-in-time recovery are enabled on the Supabase project.
- [ ] `security@nakhla.ai` is monitored, and `/.well-known/security.txt` resolves.
- [ ] The DPA, sub-processor list and privacy notice are published, and match `/security`.
- [ ] An independent penetration test is booked, and its high or critical findings are fixed before the letter is shared.
- [ ] SOC 2 readiness work has an owner and dates. Nothing on the site claims certification.

## 11. Compliance checklists by jurisdiction

These are operational reminders for firms using Nakhla, not legal advice. Each firm should confirm its obligations with counsel.

### United Arab Emirates

- [ ] Brokerage licensed, and each agent's RERA Broker Registration Number (Dubai) or ADREC registration (Abu Dhabi) recorded on their profile.
- [ ] A Trakheesi or ADREC permit on every advertised listing (Nakhla blocks publishing without one).
- [ ] Registered on goAML with the UAE Financial Intelligence Unit, with an MLRO appointed and named in Compliance settings.
- [ ] Real Estate Activity Reports (REAR) filed for cash and virtual-asset transactions at or above the threshold. Suspicious transaction reports are reviewed and filed by the MLRO.
- [ ] Customer due diligence on buyers, sellers and beneficial owners, with enhanced checks for PEPs and high-risk countries.
- [ ] Personal data handled under the PDPL (or DIFC DP Law 2020 / ADGM DPR 2021 in the free zones), with a processing agreement and data subject request handling.
- [ ] Records kept at least five years (Nakhla default: seven).

### India

- [ ] Agents registered with the state RERA, and the project's RERA number shown on listings.
- [ ] Registered as a reporting entity on FINnet 2.0 where the PMLA applies to the firm's transactions, with a Principal Officer and Designated Director appointed.
- [ ] Suspicious and cash transaction reports prepared for FIU-IND.
- [ ] FEMA position confirmed for NRI buyers (repatriation, permitted acquisitions).
- [ ] Notices, consent and grievance handling under the Digital Personal Data Protection Act 2023 and the DPDP Rules.
- [ ] Records kept at least five years.

### United Kingdom

- [ ] Registered with HMRC for anti-money-laundering supervision as an estate agency business.
- [ ] Member of a redress scheme (The Property Ombudsman or the Property Redress Scheme).
- [ ] Material information (Parts A to C) on every listing, under consumer protection law.
- [ ] Suspicious activity reports submitted to the National Crime Agency by the nominated officer.
- [ ] Registered with the ICO, with data handled under the UK GDPR and Data Protection Act 2018. Marketing consent follows PECR.
- [ ] Records kept five years from the end of the relationship.

### Singapore

- [ ] Agency and salespersons licensed and registered with the Council for Estate Agencies (CEA), with registration numbers on listings.
- [ ] Customer due diligence under the CEA's AML guidelines. Suspicious transactions reported to STRO.
- [ ] Personal data handled under the PDPA, with Do Not Call registry checks before marketing calls or messages.
- [ ] Records kept at least five years.

### Australia

- [ ] Agency licensed in each state of operation (for example, NSW Fair Trading or Consumer Affairs Victoria).
- [ ] Underquoting rules respected on price guides in New South Wales and Victoria.
- [ ] Obligations under the AML/CTF Act as extended to real estate professionals by the 2024 amendments (enrolment with AUSTRAC, an AML/CTF programme, reporting). Confirm the commencement dates that apply.
- [ ] Personal information handled under the Privacy Act 1988 and the Australian Privacy Principles. Electronic marketing follows the Spam Act 2003.

### United States

- [ ] Brokerage and salespeople licensed in each state (for example, the New York Department of State), with licence details where state advertising rules require them.
- [ ] Advertising reviewed against the Fair Housing Act.
- [ ] Text and WhatsApp marketing compliant with the TCPA and email with CAN-SPAM; only consenting leads enter campaigns.
- [ ] FinCEN's residential real estate reporting requirements reviewed for non-financed transfers to entities and trusts. Confirm the rule's current status and who in the transaction is the reporting person.
- [ ] State privacy laws (for example, CCPA/CPRA in California) reviewed for the firm's clients.

## 12. Screenshots

There are 134 screenshots in `docs/screenshots/production/`, named by feature: `f6-` to `f21-` for features, and `f22-` for the seven brokerages, the wider product, the client portal and mobile layouts. Desktop captures are 1440 pixels wide and mobile captures 390. The automated sweep found no page errors, no server errors and no horizontal overflow.
