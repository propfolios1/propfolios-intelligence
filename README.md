# Nakhla

Nakhla is an AI operating system for real estate advisory firms. Each firm (a tenant) gets its own branded workspace: mandates run through twelve AI agents (research, underwriting with a 10,000-path Monte Carlo, due diligence, a bull and bear debate, and a committee memo in the firm's house style), a market desk with BUY, HOLD and SELL signals per emirate, a UAE and India comparison, and a private portal for the firm's clients.

Tenant number one is PropFolios.ae. Further firms sign up themselves at `/onboarding` or are created by you in the platform console at `/platform`.

The instructions below assume no technical background. Each step happens in a web browser. Allow about 45 minutes.

## What you need

| Account | Cost | Used for |
| --- | --- | --- |
| GitHub | Free | Holds the code |
| Vercel | Free to start, Pro (USD 20 a month) recommended | Runs the website |
| Neon | Free to start | The database |
| Clerk | Free up to 10,000 monthly users | Sign-in and firm workspaces |
| Anthropic | Pay as you use, about USD 1.40 per mandate | The AI agents |

Keep a notes file open. You will copy several keys into it.

## Deploy in eleven steps

### 1. GitHub

1. Sign in at github.com.
2. Confirm the repository `propfolios-intelligence` is in your account (or your organisation's). If someone shared it with you, click **Fork** at the top right to copy it into your own account.

### 2. Import into Vercel

1. Sign in at vercel.com with your GitHub account.
2. Click **Add New → Project**.
3. Find `propfolios-intelligence` and click **Import**.
4. Leave every build setting as it is. Open **Environment Variables** and add one now:
   - Name `SETUP_SECRET`, value: any long random phrase, for example `river-cedar-falcon-7193-harbour`. Write it in your notes file.
5. Click **Deploy** and wait about three minutes. The site works at this point on a temporary built-in database, in demonstration mode.

### 3. Neon (the database)

1. In your Vercel project open **Storage → Create Database**.
2. Choose **Neon** (Serverless Postgres), accept the terms, choose the region closest to the Gulf (Frankfurt or Mumbai), and click **Create**.
3. Click **Connect Project**, choose all environments, and confirm. Vercel adds `DATABASE_URL` automatically.

### 4. Clerk (sign-in and firm workspaces)

1. Sign up at clerk.com and click **Create application**. Name it `Nakhla`. Leave **Email** ticked as the sign-in method. Click **Create**.
2. Copy the two keys shown, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`, into your notes file.
3. Turn on Organizations: left menu **Configure → Organizations → Enable organizations**. Each firm on Nakhla is one Clerk organisation.
4. Put the role into the sign-in token: **Configure → Sessions → Customize session token → Edit**, paste the line below, and click **Save**.

   ```json
   { "metadata": "{{user.public_metadata}}" }
   ```

5. Add the webhook so new sign-ups are linked to their firm: **Configure → Webhooks → Add Endpoint**.
   - Endpoint URL: `https://YOUR-SITE.vercel.app/api/webhooks/clerk` (your Vercel address, shown on the project page).
   - Events: tick `user.created` and `user.updated`.
   - Click **Create**, then copy the **Signing Secret** (starts `whsec_`) into your notes file.

### 5. Anthropic (the AI agents)

1. Sign in at console.anthropic.com.
2. Open **Billing** and add a payment method with at least USD 20 of credit.
3. Open **API Keys → Create Key**, name it `Nakhla`, and copy the key (starts `sk-ant-`) into your notes file. It is shown once.

### 6. Environment variables

In Vercel open your project → **Settings → Environment Variables** and add each of these for all environments:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | from step 4 |
| `CLERK_SECRET_KEY` | from step 4 |
| `CLERK_WEBHOOK_SECRET` | from step 4 |
| `ANTHROPIC_API_KEY` | from step 5 |
| `CRON_SECRET` | any long random phrase |
| `NEXT_PUBLIC_APP_URL` | your site address, for example `https://nakhla.vercel.app` |

Optional, recommended:

- **File storage:** **Storage → Create → Blob → Connect**. Vercel adds `BLOB_READ_WRITE_TOKEN`; uploaded documents and delivered memo PDFs are then stored.
- **Rate limiting across servers:** **Storage → Marketplace → Upstash Redis → Connect**. Vercel adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Without it each server limits requests on its own, which is adequate for a small number of firms.
- **Current model:** `ANTHROPIC_MODEL_PRIMARY` = `claude-sonnet-5-5`. The default, `claude-sonnet-4-20250514`, is deprecated by Anthropic.
- **Street map:** `NEXT_PUBLIC_MAPBOX_TOKEN` from mapbox.com.

### 7. Deploy

Open **Deployments**, click the three dots on the latest one, and choose **Redeploy**. Wait until it shows **Ready**.

### 8. Create the tables

Visit this address in your browser, replacing the two parts in capitals:

```
https://YOUR-SITE.vercel.app/api/setup?secret=YOUR_SETUP_SECRET
```

You should see `"ok": true` and `"seeded": true`. This creates the tables and the starting data: the PropFolios workspace with its demonstration mandates and clients, and three sample firms (Gulf Crest Capital, Meridian Family Office and Al Noor Realty Advisors) so the platform console has something to show. Visiting the address again changes nothing. To wipe and reload everything add `&reset=1`.

### 9. Make yourself the platform administrator

1. Open your site and click **Sign in → Sign up**. Register with your own email address.
2. In Clerk open **Users**, click your name, scroll to **Public metadata**, click **Edit**, paste the line below and click **Save**.

   ```json
   { "role": "platform_admin" }
   ```

3. Sign out of your site and sign in again. You arrive at **/platform/dashboard**, the Nakhla console: monthly revenue, firms, seats, AI cost and agent quality.

### 10. Create the PropFolios workspace

The seeded PropFolios workspace already exists and holds the demonstration data. To give Amol his own login:

1. In the console open **Tenants → PropFolios.ae**.
2. Check the plan (Professional, 20 seats) and the feature switches.
3. Amol's administrator record (`amol@propfolios.ae`) is already in the workspace and waiting for him. Nothing more to create. To add colleagues later, click **Open as administrator**, then **Administration → Users → Invite people**.

To create a brand-new firm instead, open **Tenants → Create tenant**, fill in the five steps (firm, brand, plan, administrator, team) and click **Create tenant**. The administrator receives an invitation by email.

### 11. Send Amol his login

Send Amol a short note:

> Your PropFolios workspace on Nakhla is ready. Open https://YOUR-SITE.vercel.app/sign-up, register with amol@propfolios.ae and choose a password. You will land on the analyst desk. Administration (users, branding, billing) is in the left menu.

When he registers with that address, his account is linked to the seeded administrator record, and he sees the PropFolios brand, data and clients.

## Plans

Enforced in code (`lib/plans.ts`). Seats count administrators and analysts; client logins are free.

| Plan | Monthly, AED | Seats | Notes |
| --- | --- | --- | --- |
| Starter | 3,000 | 5 | Nakhla styling |
| Professional | 8,000 | 20 | Own logo and colours |
| Enterprise | 25,000 | Unlimited | Own logo and colours |
| White-label | 50,000 | Unlimited | Own domain, Nakhla branding removed |

A firm on White-label adds its domain in **Administration → Branding**, then points the domain at Vercel (**Settings → Domains → Add**). Invoices are computed and shown on **Administration → Billing** (VAT 5%); card collection is not connected.

## Roles

| Role | Sees |
| --- | --- |
| Platform administrator | `/platform`: every firm, revenue, AI metrics, feature switches. **Open as administrator** opens a firm's workspace as its administrator; each visit is recorded in that firm's audit log. |
| Firm administrator | Analyst desk plus Administration: users, branding, billing, audit log, demonstration data |
| Analyst | Analyst desk: mandates, properties, developers, market, clients, memos, assistant |
| Client | Own portfolio, opportunities, recommendations, documents, messages, assistant |

## Troubleshooting

**Build errors**

| Symptom | Fix |
| --- | --- |
| Vercel build fails at *Installing dependencies* | Redeploy once; the npm registry occasionally times out. |
| Build fails with a type or lint error | The code on your branch was changed. Redeploy the last deployment that showed **Ready** (three dots → **Promote to Production**) and send the error log to your developer. |
| *Function exceeded maximum duration* during a mandate | On the Hobby plan functions stop at 60 seconds. The run resumes automatically; upgrade to Pro for uninterrupted runs. |

**Database connection**

| Symptom | Fix |
| --- | --- |
| `/api/setup` says *SETUP_SECRET is not set* | Add the variable (step 2) and redeploy. |
| `/api/setup` says *Invalid setup secret* | The `secret=` value must match exactly, including capitals. |
| Data disappears after a while | `DATABASE_URL` is missing, so the temporary built-in database is in use. Complete step 3 and redeploy. |
| *Connection refused* or *password authentication failed* | In Neon, open the project, **Connection Details**, copy the **pooled** connection string, and replace `DATABASE_URL` in Vercel. Redeploy. |
| *Endpoint is disabled* | Neon pauses free databases when idle. Open the Neon dashboard once; it wakes within seconds. |

**Clerk and firm setup**

| Symptom | Fix |
| --- | --- |
| Sign-in page shows demonstration personas | The Clerk keys are missing or the project was not redeployed. |
| After sign-up you see *Set up your firm* | Your account is not linked to a firm. Either complete the form (it creates a firm on a 14-day trial) or ask the platform administrator to invite your email. |
| You set `platform_admin` but still see a firm | Check the session token step (4.4), then sign out and in again. |
| Invitations are not sent | Organizations are not enabled (step 4.3), or the firm has no free seat (**Administration → Billing** shows seat use). |
| New users are not linked to their firm | The webhook (step 4.5) is missing, or `CLERK_WEBHOOK_SECRET` does not match. Clerk → Webhooks shows failed deliveries. |
| A firm sees *This workspace is suspended* | Its status is Suspended or Cancelled. Change it in **/platform → Tenants → the firm**. |

**Anthropic rate limits**

| Symptom | Fix |
| --- | --- |
| Timeline shows *replay mode* | `ANTHROPIC_API_KEY` is missing or the project was not redeployed. Replay mode returns rule-based output so every screen still works. |
| An agent stage failed with *rate limit* or *overloaded* | Agents already retry five times with increasing waits. Wait a minute, then open the mandate and click **More → Re-run from stage**. For many firms, raise your usage tier in the Anthropic console under **Limits**. |
| *Too many requests* from Nakhla itself | Each user may run 30 agent requests and 20 assistant questions a minute. Wait a minute. |
| *Credit balance is too low* | Add credit in the Anthropic console under **Billing**. |

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes for persistence | Neon connection string |
| `SETUP_SECRET` | Yes | Protects `/api/setup` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | For sign-in | Without them the app runs in demonstration mode with persona switching |
| `CLERK_WEBHOOK_SECRET` | With Clerk | Verifies the `user.created` and `user.updated` webhook |
| `ANTHROPIC_API_KEY` | For live agents | Without it agents run in replay mode |
| `ANTHROPIC_MODEL_PRIMARY`, `ANTHROPIC_MODEL_FAST` | No | Model overrides |
| `CRON_SECRET` | For scheduled jobs | Authorises Vercel Cron (daily portfolio monitor, weekly digest on Mondays, weekly developer risk) |
| `BLOB_READ_WRITE_TOKEN` | No | Stores uploads and delivered memo PDFs |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) | No | Shared rate limiting |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | No | Street-level map |
| `NEXT_PUBLIC_APP_URL` | Recommended | Links in invitations |

## For developers

Next.js 15 App Router, TypeScript strict, Tailwind 4, Drizzle ORM on Neon with pgvector (embedded PGlite fallback), Clerk Organizations, Anthropic SDK with tool-calling structured output, TanStack Query, Zustand, Recharts, TipTap, dnd-kit, cmdk, Zod and @react-pdf/renderer.

Multi-tenancy: every table carries `tenant_id`; every query goes through `scope()` or `tenantDb()` in `lib/tenant-db.ts`, which throw when the tenant is missing; Postgres row-level security policies (`drizzle/0001_nakhla_multitenancy.sql`) apply to any role other than the table owner.

```
app/            routes: public, platform, admin, analyst, client, api
components/     ui primitives, composites, charts, shell, platform, admin, marketing
db/             schema, migrations runner, seed (per tenant)
drizzle/        SQL migrations
lib/ai/         agents, prompts (versioned _v1, _v2), schemas, orchestrator, replay, financial engine
lib/            auth, tenant, plans, provisioning, rate limit, queries
```

Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run type-check`, `npm test`, `npm run db:generate`.

See `CLAUDE.md` for the specification, `DESIGN.md` for the design system and `docs/BUILD_REPORT.md` for the build report.
