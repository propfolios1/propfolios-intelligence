# Nakhla

Nakhla is the AI-native operating system for real estate brokerages, built for six markets: the UAE and India with the full regulatory engine, and the UK, Singapore, Australia and the US localised for brokerage. Each firm (a tenant) gets its own branded workspace that runs the whole business, from the first lead to the commission in the bank:

- **Brokerage.** Lead capture from 18 portals and direct channels with itemised scoring, listings checked against portal rules and syndicated through signed feeds, consent-based marketing, rentals and rent collection, referrals, and offices, licences, targets and recruiting.
- **Mandates.** Specialist agents research, underwrite, value, diligence and write committee memos; three models review every recommendation independently.
- **India.** Mumbai and Goa diligence, with MahaRERA and Goa RERA, land records (7/12, property card, Form I and XIV, comunidade), the Maharashtra and Goa stamp duty rules, and NRI planning.
- **Deals.** Offers, negotiation rounds, contracts, electronic signature, closing checklists and payment schedules.
- **Commission.** Structures, splits, VAT and GST invoices, payments, bank reconciliation and tax returns, computed automatically when a deal closes.
- **Clients.** KYC, AML screening, quarterly reports, monthly statements, goals, tax documents and private banking.
- **Business intelligence.** Firm metrics, cross-firm benchmarks and four data products.
- **The fabric underneath.** One data model, eleven access roles, a full audit trail, GDPR, DPDP and UAE PDPL request and consent workflows, automations, notifications and five interface languages.

Forty-eight agents do the work. An event bus starts the right agents whenever something happens, and every agent remembers what it has learned about the firm. Anonymised learnings from completed deals across firms calibrate every model: the more firms use Nakhla, the sharper it becomes for each of them.

Firms start a fourteen-day trial at `/trial` or sign up at `/onboarding`, or you create them in the platform console at `/platform`. Anyone can try the analytical pipeline at `/demo` without an account.

This guide assumes no technical background. Everything happens in a web browser, in GitHub, Supabase, Clerk, Anthropic and Vercel. Allow about an hour.

## What you need

| Account | Cost | Used for |
| --- | --- | --- |
| GitHub | Free | Holds the code |
| Supabase | Free to start; Pro (USD 25 a month) recommended | Database, file storage, live updates |
| Clerk | Free up to 10,000 monthly users | Sign-in and firm workspaces |
| Anthropic | Pay as you use, about USD 1.50 per mandate | The AI agents |
| Resend | Optional; free up to 3,000 emails a month | Invoices, signature requests and notification emails |
| Dropbox Sign | Optional; Nakhla's native signature works without it | Electronic signature with a provider audit trail |
| Vercel | Free to start; Pro (USD 20 a month) recommended | Runs the website |

Open a notes file now. You will copy about ten values into it.

## Deploy, step by step

### 1. GitHub

1. Sign in at github.com (create a free account if you need one).
2. Confirm the repository `propfolios-intelligence` is in your account or organisation. If someone shared it with you, click **Fork** (top right) to copy it into your account.

### 2. Supabase: create the project

1. Go to supabase.com and sign in with GitHub.
2. Click **New project**. Name it `nakhla`.
3. Click **Generate a password**, then copy the password into your notes file.
4. Region: **Mumbai** (closest to the Gulf) or **Frankfurt**. Plan: Free is fine to start.
5. Click **Create new project** and wait about two minutes.

### 3. Supabase: switch on pgvector

1. In the left menu open **Database → Extensions**.
2. Search for `vector`, and switch it on (schema: `extensions` or `public`, either works).

Nakhla also switches it on during setup (step 11); doing it here first avoids a permission prompt on some projects.

### 4. Supabase: copy the keys and the connection string

1. Open **Project Settings → API**. Copy into your notes:
   - **Project URL** (for `NEXT_PUBLIC_SUPABASE_URL`)
   - **anon public** key (for `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
   - **service_role** key (for `SUPABASE_SERVICE_ROLE_KEY`). Keep this one private.
2. Click **Connect** at the top of the page. Under **Connection string** choose **Transaction pooler** and copy the address. Replace `[YOUR-PASSWORD]`, including the square brackets, with the password from step 2. This is your `DATABASE_URL`.

### 5. Clerk: create the application

1. Go to clerk.com, sign up, and click **Create application**. Name it `Nakhla`, leave **Email** ticked, and click **Create**.
2. Copy `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into your notes.
3. Turn on Organizations: **Configure → Organizations → Enable organizations**. Each firm on Nakhla is one Clerk organisation.
4. Put the role into the session token: **Configure → Sessions → Customize session token → Edit**, paste the line below, click **Save**.

   ```json
   { "metadata": "{{user.public_metadata}}", "role": "authenticated" }
   ```

### 6. Let Supabase trust Clerk

This lets the database itself check every signed-in user's firm (row-level security), so live updates in the browser can never cross from one firm to another.

1. In Clerk open **Integrations** (or **Configure → Integrations**), find **Supabase** and click **Activate** (or **Connect with Supabase**). Clerk shows your **Clerk domain**, for example `https://your-app.clerk.accounts.dev`. Copy it.
2. In Supabase open **Authentication → Sign In / Providers → Third-Party Auth** (older dashboards: **Authentication → JWT Settings**). Click **Add provider → Clerk**, paste the Clerk domain, and save.

Supabase now accepts Clerk session tokens. Nakhla's policies read the user (`sub`) and organisation (`org_id`) from them.

### 7. Supabase: storage buckets

Nakhla creates four private buckets automatically during setup (step 11): `documents`, `memos`, `branding` and `avatars`. Nothing to do here. If you prefer to create them yourself: **Storage → New bucket**, enter the name, leave **Public bucket** off, click **Save**; repeat for each.

Files are stored under each firm's own folder; the database policies allow a firm to reach only its own folder, and clients only their own documents.

### 8. Anthropic

1. Sign in at console.anthropic.com.
2. **Billing**: add a payment method and at least USD 20 of credit.
3. **API Keys → Create Key**, name it `Nakhla`, copy it (it starts `sk-ant-`). It is shown once.

### 9. Vercel: import the project

1. Sign in at vercel.com with GitHub.
2. **Add New → Project**, find `propfolios-intelligence`, click **Import**.
3. Optional but recommended: in the project's **Integrations** tab add **Clerk** (it can fill the two Clerk keys for you).
4. Open **Environment Variables** and add each of these (all environments):

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | step 4 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | step 4 |
| `SUPABASE_SERVICE_ROLE_KEY` | step 4 |
| `DATABASE_URL` | step 4 |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | step 5 |
| `CLERK_SECRET_KEY` | step 5 |
| `ANTHROPIC_API_KEY` | step 8 |
| `SETUP_SECRET` | any long random phrase, for example `river-cedar-falcon-7193-harbour` (write it down) |
| `CRON_SECRET` | another long random phrase |
| `NEXT_PUBLIC_APP_URL` | your site address, for example `https://nakhla.vercel.app` (you can update it after the first deploy) |

Optional, for email: `RESEND_API_KEY` and `RESEND_FROM` (resend.com → API Keys; verify your domain under Domains first). Optional, for Dropbox Sign: `DROPBOX_SIGN_API_KEY` and `DROPBOX_SIGN_TEST_MODE` (`true` while testing). Without them emails wait in the outbox and contracts use Nakhla's native signature, so nothing stops working.

Optional: `ANTHROPIC_MODEL_DEEP`, `ANTHROPIC_MODEL_PRIMARY`, `ANTHROPIC_MODEL_FAST` to choose models (the defaults, Claude Opus 4, Sonnet 4 and Haiku 4.5, are deprecated by Anthropic; `claude-opus-5-5`, `claude-sonnet-5-5` and `claude-haiku-4-5` are the current ones). `FEDERATION_SALT` (any random phrase, set once and never change). `KV_REST_API_URL` and `KV_REST_API_TOKEN` from **Storage → Upstash Redis** for shared rate limiting. The full list with explanations is in `.env.example`.

### 10. Deploy

Click **Deploy** and wait about three minutes until it shows **Ready**. Then add the Clerk webhook so new sign-ups join the right firm:

1. Clerk → **Configure → Webhooks → Add Endpoint**.
2. URL: `https://YOUR-SITE.vercel.app/api/webhooks/clerk`. Events: `user.created` and `user.updated`. Click **Create**.
3. Copy the **Signing Secret** (starts `whsec_`), add it in Vercel as `CLERK_WEBHOOK_SECRET`, and redeploy (**Deployments → ⋯ → Redeploy**).
4. If you use Dropbox Sign: Dropbox Sign → **API** → **Account callback**, enter `https://YOUR-SITE.vercel.app/api/webhooks/dropbox-sign` and click **Test**. Nakhla answers with the confirmation Dropbox Sign expects.

### 11. Create the tables, security policies and starting data

Visit, replacing the two parts in capitals:

```
https://YOUR-SITE.vercel.app/api/setup?secret=YOUR_SETUP_SECRET
```

You should see `"ok": true` and `"seeded": true`. This creates all 66 tables and the 246 row-level security policies, plus the storage buckets and their policies and the live-update channels. It also loads the starting data:
- the demonstration workspace, Nakhla Demo Brokerage, with demonstration logins;
- four further demonstration firms with their own data: Sample Realty Dubai, Demo Properties India, London Prime Brokers and Singapore Luxury Homes. None of them is a real company;
- a trial firm and a former firm;
- 55 properties across Dubai, Abu Dhabi, Mumbai and Goa;
- deals at every stage, commissions and invoices, KYC files, reports and statements;
- benchmarks, automations and consents;
- one complete journey from mandate to paid invoice;
- the first federated baselines. Visiting again changes nothing; add `&reset=1` to wipe and reload everything.

### 12. Make yourself the platform administrator

1. Open your site, click **Sign in → Sign up**, register with your own email.
2. In Clerk open **Users**, click your name, scroll to **Public metadata**, click **Edit**, paste the line below, **Save**.

   ```json
   { "role": "platform_admin" }
   ```

3. Sign out of your site and back in. You land on **/platform/dashboard**: revenue, firms, AI quality and the federation.

### 13. Create your own firm

The demonstration firms exist only to show the product. Create your real workspace in **/platform → Tenants → Create tenant** and complete the five steps; the administrator you name receives an invitation and, on registering with that address, is linked to the workspace automatically. A firm can also create its own workspace at `/trial`.

### 14. Hand over the login

> Your workspace on Nakhla is ready. Open https://YOUR-SITE.vercel.app/sign-up, register with the address this message was sent to and choose a password. You land on the analyst desk; Administration (users, branding, billing, intelligence settings) is in the left menu.

## What each firm gets

| Module | Where |
| --- | --- |
| India: Mumbai and Goa projects, MahaRERA and Goa RERA complaints, land records parsed from uploads, Ready Reckoner, DCPR 2034, Regional Plan 2021, CRZ, comunidade; stamp duty and tax calculator (Mumbai 6%, Goa 3.5%, 2.5% for women in Goa); NRI plan | Analyst → India; Client → India, NRI plan |
| Deals: offers and counters, negotiation rounds, contracts (Form F, SPA, agreement for sale, deed of sale), native or Dropbox Sign signature, closing checklist by jurisdiction, payment schedule; six deal agents | Analyst → Deals; Client → Transactions |
| Commission: structures (percentage, tiered or fixed fee, matched by jurisdiction, deal type and value), splits, VAT and GST invoices with TDS, payments, CSV bank reconciliation, VAT and GST returns; computed, invoiced and sent automatically on close | Administration → Commissions, Invoices; Analyst → My commissions; Client → Invoices |
| Client layer: KYC with document expiry reminders, AML screening (sanctions, PEP, adverse media), quarterly reports, monthly statements, goals, tax documents, wallet share; private banking above AED 50M | Administration → KYC and AML, Reports; Client → Reporting |
| Business intelligence: firm metrics against peers, benchmarks published only at five firms and twenty deals, market reports, four data products | Analyst → Benchmarks; Administration → Data products; Platform → Business intelligence |
| Fabric: client 360, eleven access roles, audit trail with before and after, data subject requests and consents, automations, notifications and @mentions, English, Arabic, Hindi, Marathi and Konkani | Administration → Users, Compliance, Automations, AI control; Notifications; the language menu at the foot of the sidebar |
| AI: forty-five agents, nine events on the bus, agent memory, mandate journey, budget and per-agent switches | Mandate → Journey; Analyst → AI memory; Administration → AI control; Platform → Agents |
| Mandate pipeline: thirteen domain agents (research, underwriting, valuation, due diligence, memo, debate, comparables, developer risk, market timing, cross-border, portfolio monitor, recommender) plus the assistant | Mandates, Market, Properties, Assistant |
| Multi-agent debate: bull, bear and judge | Mandate → Debate |
| Multi-model cross-validation: the decision re-run on a deep, a primary and a fast model; disagreement flags the mandate | Mandate → Debate, header badge |
| Proactive insights: price movements, developer distress, undervalued stock, exit windows | Insights (analysts and clients), dashboards |
| Agentic actions: share memo, signature envelope, lender link, follow-up, client record, escalation, rent reminder; approve, then reverse if needed | Mandate → Actions |
| Federated intelligence: anonymised baselines from completed deals across firms | Federation, Underwriting tab, Administration → Intelligence |
| MCP server for external systems: seventeen tools, from properties and research to deals, commissions, client 360, benchmarks, KYC and AML | Administration → Integrations |

## Plans

Enforced in code (`lib/plans.ts`). Seats count administrators and analysts; client logins are free.

| Plan | Monthly, AED | Seats | Notes |
| --- | --- | --- | --- |
| Starter | 3,000 | 5 | Nakhla styling |
| Professional | 8,000 | 20 | Own logo, colours and memo house style |
| Enterprise | 25,000 | Unlimited | Priority capacity |
| White-label | 50,000 | Unlimited | Own domain |

## Scheduled jobs

Set in `vercel.json` and run by Vercel automatically: portfolio monitor (daily 04:00 UTC; weekly digest on Mondays), insight agent (daily 06:00 UTC), federation aggregation (nightly 22:00 UTC, 02:00 Gulf time) and developer risk (Mondays), client servicing (daily 03:00 UTC: overdue invoices, KYC expiry reminders at 30, 14, 7 and 1 days, AI budget alerts; statements on the 1st, quarterly reports and wallet share each quarter, tax documents on 1 April) and business intelligence (nightly 23:00 UTC: firm metrics, benchmarks and the data products). The insight agent also re-runs for a firm whenever new market data arrives (a database trigger marks it stale; the next page load refreshes it). On Vercel Pro you can run the insight agent every six hours: change its schedule to `0 */6 * * *`.

## Troubleshooting

**Build errors**

| Symptom | Fix |
| --- | --- |
| Build fails while installing dependencies | Redeploy once; the package registry occasionally times out. |
| Build fails with a type or lint error | The code was changed. Promote the last deployment that showed **Ready** (**Deployments → ⋯ → Promote to Production**) and send the log to your developer. |
| *Function exceeded maximum duration* during a mandate | Hobby functions stop at 60 seconds. The run resumes automatically; Vercel Pro avoids the interruptions. |

**Supabase connection errors**

| Symptom | Fix |
| --- | --- |
| `/api/setup` says *SETUP_SECRET is not set* or *Invalid setup secret* | Add the variable and redeploy; the `secret=` value must match exactly. |
| *password authentication failed* | The password in `DATABASE_URL` is wrong or the square brackets were left in. Supabase → **Project Settings → Database → Reset database password**, update `DATABASE_URL`, redeploy. |
| *Invalid URL* or *ENOTFOUND* | The password contains `@`, `#` or `/`. Reset it to letters and numbers only. |
| *Connection terminated* or timeouts | Use the **Transaction pooler** address (port 6543). |
| *Project is paused* | Free Supabase projects pause after a week unused. Open the project and click **Restore project**; Pro never pauses. |
| *permission denied to create extension "vector"* | Do step 3, then visit `/api/setup` again. |
| Data disappears; **Administration → Demonstration data** says *Embedded Postgres* | `DATABASE_URL` is missing. Add it and redeploy. |
| Uploads say *File storage is not configured* | `SUPABASE_SERVICE_ROLE_KEY` or `NEXT_PUBLIC_SUPABASE_URL` is missing. |

**RLS blocking queries**

| Symptom | Fix |
| --- | --- |
| Live indicator shows *Auto-refresh* instead of *Live* | Realtime could not authenticate. Check `NEXT_PUBLIC_SUPABASE_ANON_KEY`, step 6, and that the session token includes `"role": "authenticated"` (step 5.4). Pages still refresh every twenty seconds. |
| A live feed stays empty while the page shows data | The user's Clerk account is not linked to a firm, or their organisation is not mapped. Check **Administration → Users** shows them as Active. |
| Server pages fail with *permission denied for table* | `DATABASE_URL` must use the `postgres` user (the table owner), as Supabase's connection string does. Do not use a restricted role. |

**Clerk JWT not trusted**

| Symptom | Fix |
| --- | --- |
| Supabase logs show *invalid JWT* or *no suitable key* | Step 6 was skipped, or the Clerk domain was pasted with a trailing path. Use the bare domain, for example `https://your-app.clerk.accounts.dev`. |
| You set `platform_admin` but still see a firm | Check the session token (step 5.4), then sign out and in. |
| New users are not linked to their firm | The webhook (step 10) is missing or `CLERK_WEBHOOK_SECRET` does not match. Clerk → Webhooks shows failed deliveries. |
| Invitations are not sent | Organizations are not enabled, or the firm has no free seat (**Administration → Billing**). |

**Email, signatures and languages**

| Symptom | Fix |
| --- | --- |
| Invoices show *not configured* under email | `RESEND_API_KEY` is not set; the email is kept in the outbox. Add the key, then use **Send** on the invoice. |
| Resend rejects the sender | `RESEND_FROM` must use a domain verified in Resend → Domains. |
| Signature requests use the native signature | `DROPBOX_SIGN_API_KEY` is not set. Both methods record signer, time, IP address and the contract hash. |
| Dropbox Sign shows the callback as failing | Register `/api/webhooks/dropbox-sign` (step 10.4) on the same account as the API key. |
| The interface is in the wrong language | Choose the language at the foot of the sidebar (on a phone, in the menu). It is remembered per browser. Navigation and titles are translated; reports and agent output stay in English. |

**Anthropic rate limits**

| Symptom | Fix |
| --- | --- |
| Timeline shows *replay mode* | `ANTHROPIC_API_KEY` is missing; agents return rule-based output so every screen still works. |
| A stage failed with *rate limit* or *overloaded* | Agents already retry five times with increasing waits. Wait a minute and use **More → Re-run from stage**. For many firms, raise your usage tier in the Anthropic console under **Limits**. Cross-validation makes three calls per mandate; the deep model is the slowest. |
| *Too many requests* from Nakhla | Per-user limits: 30 agent runs and 20 assistant questions a minute. |
| *Credit balance is too low* | Add credit under **Billing** in the Anthropic console. |

## For developers

Next.js 15 App Router, TypeScript strict, Tailwind 4, Drizzle ORM (postgres-js) on Supabase Postgres with pgvector, Supabase Storage and Realtime (`@supabase/supabase-js`), Clerk Organizations, Anthropic SDK with tool-calling structured output, Model Context Protocol SDK, TanStack Query, Recharts, TipTap, dnd-kit, cmdk, Zod and @react-pdf/renderer. Without `DATABASE_URL` an embedded PGlite database migrates and seeds itself; without Clerk the app runs in demonstration mode; without Anthropic the agents replay deterministically.

Tenant isolation has three layers:
- **Application.** `lib/tenant-db.ts` scopes every query, and unscoped access throws.
- **Database.** `drizzle/0004_rls_jwt_storage_realtime.sql` and `0005_full_os.sql` set four policies per table, resolved from Clerk JWT claims. Client users are limited to their own records, and the federation tables are closed.
- **Storage.** Policies on the `{tenant_id}/` prefix.

`npm run verify:rls` checks the database layer. It signs in as one firm and confirms that no other firm's rows can be read, updated, deleted or inserted, across all 60 tenant tables.

The vertical OS sits in these places:
- `lib/regulations` holds the jurisdiction rules engine.
- `lib/india`, `lib/deals`, `lib/commission`, `lib/client` and `lib/bi` hold the modules.
- `lib/os` holds automations, compliance, notifications, the schedule and the journey.
- `lib/rbac` holds the access roles, and `lib/data-model` holds the client, property and firm 360.
- `lib/ai/os-agents` holds agents 14 to 45, with their prompts in `lib/ai/prompts/{name}_v1.ts`.
- `lib/ai/orchestration` holds the event bus.
- `lib/ai/memory` holds agent memory.
- `messages/` holds the five locales.

```
app/            routes: public, demo, platform, admin, analyst, client, share, api (incl. /api/mcp)
components/     ui primitives, composites, charts, intelligence, realtime, shell, platform, admin, marketing
db/             schema, connection, seed (tenants, intelligence, federation)
drizzle/        SQL migrations (0004: RLS, storage, realtime, triggers)
lib/ai/         agents, versioned prompts, schemas, orchestrator, cross-validation, replay, financial and valuation engines
lib/            actions, insights, federation, mcp, storage, supabase, auth, tenancy, plans
lib/{regulations,india,deals,commission,client,bi,os,rbac,data-model}   the vertical OS modules
messages/       en, ar, hi, mr, kok
scripts/        verify-rls.mjs
```

Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run type-check`, `npm test`, `npm run db:generate`, `npm run verify:rls`.

See `CLAUDE.md` for the specification, `DESIGN.md` for the design system `docs/BUILD_REPORT.md` for the platform build report and `docs/OS_BUILD_REPORT.md` for the vertical OS.
