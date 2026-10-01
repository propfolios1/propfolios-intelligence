# PropFolios Intelligence

Institutional real estate advisory platform for PropFolios.ae. Analysts open mandates; twelve AI agents research, underwrite, diligence, debate and draft an Allocation Memo; the investment committee approves; the client receives the memo in a private portal with their portfolio, alerts, recommendations, documents, messages and a cited assistant.

This guide deploys it using only web dashboards. No terminal is needed.

---

## What you need

| Service | Why | Cost to start |
| --- | --- | --- |
| GitHub account | Holds the code (`propfolios1/propfolios-intelligence`) | Free |
| Vercel account | Hosts the app, runs scheduled jobs | Free (Hobby) or Pro |
| Neon (via Vercel) | Postgres database with pgvector | Free tier |
| Clerk | Sign-in, organisations, roles | Free up to 10,000 users |
| Anthropic | Runs the AI agents | Pay per use |
| Vercel Blob (optional) | Stores uploaded KYC and documents | Free tier |
| Mapbox (optional) | Street-level property map | Free tier |

The app works before Clerk and Anthropic are added: it runs in **demonstration mode** (persona switching, no sign-in) and the agents run in **replay mode** (deterministic output built from the same data, so every screen and flow works). Add the keys when you are ready to go live.

---

## Deploy in ten steps

### 1. Import the project into Vercel

1. Go to **vercel.com** and sign in with GitHub.
2. Click **Add New…** then **Project**.
3. Find **propfolios-intelligence** and click **Import**. If it is not listed, click **Adjust GitHub App Permissions** and grant access to the repository.
4. Leave Framework Preset as **Next.js** and every build setting at its default.
5. Open **Environment Variables** and add one variable now:
   - `SETUP_SECRET`: any long random phrase, for example `pf-setup-7f3k9q2m`. Keep it; you need it in step 4.
6. Click **Deploy**. Wait for the confetti (about two minutes).

At this point the site is live in demonstration mode on an embedded database that resets when Vercel restarts the server. Open the URL Vercel shows you and click **Analyst desk** to look around.

### 2. Add the database (Neon)

1. In your Vercel project, open the **Storage** tab.
2. Click **Create Database**, choose **Neon (Serverless Postgres)**, then **Continue**.
3. Accept the defaults (choose the region closest to your users, for example Frankfurt or Mumbai), click **Create**, then **Connect** to this project for all environments.
4. Vercel adds `DATABASE_URL` automatically. Confirm under **Settings → Environment Variables**.

### 3. Redeploy

1. Open the **Deployments** tab.
2. On the latest deployment, click the three dots, then **Redeploy**, then **Redeploy** again.

### 4. Create tables and load the demonstration data

In your browser, visit:

```
https://YOUR-PROJECT.vercel.app/api/setup?secret=YOUR_SETUP_SECRET
```

You should see `"ok": true` and `"seeded": true`. The setup enables pgvector, creates all sixteen tables and loads five clients, thirty UAE and India projects, eighteen developers, twelve months of market data per emirate and three mandates (one delivered, one in research, one at memo stage). It is safe to run again: it never duplicates data. To wipe and start over, add `&reset=1`.

### 5. Turn on sign-in (Clerk)

1. Go to **clerk.com**, sign up, and click **Create application**. Name it *PropFolios Intelligence*; enable **Email** (and Google if wanted). Click **Create application**.
2. In the Clerk dashboard, open **Configure → Organizations** and switch **Enable organizations** on.
3. Open **API Keys**. Copy the **Publishable key** and the **Secret key**.
4. In Vercel, **Settings → Environment Variables**, add:
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: the publishable key
   - `CLERK_SECRET_KEY`: the secret key
5. Back in Clerk, open **Configure → Webhooks**, click **Add Endpoint**:
   - Endpoint URL: `https://YOUR-PROJECT.vercel.app/api/webhooks/clerk`
   - Subscribe to `user.created`
   - Click **Create**, then copy the **Signing Secret**.
6. In Vercel add `CLERK_WEBHOOK_SECRET` with that signing secret.

### 6. Turn on the AI agents (Anthropic)

1. Go to **console.anthropic.com**, sign in, open **Settings → Billing** and add credit (USD 20 is plenty for a demonstration).
2. Open **API Keys**, click **Create Key**, name it *propfolios-vercel*, copy it.
3. In Vercel add `ANTHROPIC_API_KEY` with the key.
4. Recommended: add `ANTHROPIC_MODEL_PRIMARY` = `claude-sonnet-5-5` and `ANTHROPIC_MODEL_FAST` = `claude-haiku-4-5`. Without these the app uses `claude-sonnet-4-20250514` and `claude-haiku-4-5`.

### 7. Scheduled jobs and file storage

1. In Vercel add `CRON_SECRET`: any random string. Vercel uses it to authorise the two scheduled jobs defined in `vercel.json` (daily portfolio monitor at 04:00 UTC, weekly developer re-scoring on Mondays at 05:00 UTC). See them under **Settings → Cron Jobs**.
2. Optional, for real document storage: **Storage → Create Database → Blob → Create**, then **Connect** to the project. Vercel adds `BLOB_READ_WRITE_TOKEN`. Without it, uploads are recorded but files are not stored.
3. Optional, for a street-level map: create a free token at **account.mapbox.com** and add `NEXT_PUBLIC_MAPBOX_TOKEN`.

### 8. Redeploy

**Deployments → three dots → Redeploy.** Environment variables take effect only after a redeploy.

### 9. Create the administrator account

1. Open `https://YOUR-PROJECT.vercel.app/sign-up`.
2. Sign up as Amol with **amol@propfolios.ae**. The seeded administrator record has this email, so the account links to it and lands on the analyst dashboard as administrator. (The first account to sign up in a new workspace always becomes administrator.)
3. Colleagues who sign up with an `@propfolios.ae` address become analysts. Everyone else becomes a client. Seeded clients (for example ahmed@almansoori.ae) are linked to their portfolio automatically; link any new client account in **Administration → Users → row menu → Link to client record**.
4. Roles can be changed at any time in **Administration → Users** (account menu, bottom left).

### 10. Run a mandate end to end

1. Click **Create Mandate**.
2. Choose a client and a property, write a one-line objective and a brief, set the ticket size, then click **Create Mandate and run agents**.
3. Watch the **Timeline** tab: intake, research, underwriting, due diligence, debate and memo complete in sequence, streamed live.
4. Open the **Memo** tab, edit if needed (it saves automatically), then click **Approve and deliver**.
5. Click **Download memo** for the PDF. The client sees it immediately under **Documents** in their portal.

---

## Using the product

- **Cmd+K** (Ctrl+K on Windows) searches mandates, properties, clients and pages.
- **Cmd+/** lists keyboard shortcuts; **G** then a letter jumps between pages; **N** creates a mandate.
- **Clients → a client → Preview client portal** shows exactly what that client sees.
- **Administration → Seed data → Reset to seed data** restores the demonstration dataset.
- **Administration → Audit log** records every user action and every agent run with its model, tokens, duration and cost.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes for persistence | Neon connection string (set by the Vercel Neon integration) |
| `SETUP_SECRET` | Yes | Protects `/api/setup` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | For sign-in | Without them the app runs in demonstration mode |
| `CLERK_WEBHOOK_SECRET` | With Clerk | Verifies the user-created webhook |
| `ANTHROPIC_API_KEY` | For live agents | Without it agents run in replay mode |
| `ANTHROPIC_MODEL_PRIMARY`, `ANTHROPIC_MODEL_FAST` | No | Model overrides |
| `CRON_SECRET` | For scheduled jobs | Authorises Vercel Cron |
| `BLOB_READ_WRITE_TOKEN` | No | Stores uploaded files |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | No | Street-level map |

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/api/setup` says *SETUP_SECRET is not set* | Add the variable in Vercel and redeploy. |
| `/api/setup` says *Invalid setup secret* | The `secret=` value in the URL must match exactly. |
| Data disappears after a while | `DATABASE_URL` is missing, so the embedded database is in use. Complete step 2 and redeploy. |
| Sign-in page shows demonstration personas | Clerk keys are missing or the project was not redeployed. |
| Timeline shows *replay mode* | `ANTHROPIC_API_KEY` is missing or the project was not redeployed. |
| An agent stage failed | Open the mandate, click **More → Re-run from stage**. The error is in the audit log. |
| A signed-up client sees an empty portfolio | Their account is not linked to a client yet. **Administration → Users → row menu → Link to client record**. |

## For developers

Next.js 15 App Router, TypeScript strict, Tailwind 4, Drizzle ORM on Neon (pgvector) with an embedded PGlite fallback, Clerk, Anthropic SDK with tool-calling structured output, TanStack Query, Zustand, Recharts, TipTap, dnd-kit, cmdk, Zod and @react-pdf/renderer.

```
app/            routes: public, analyst, client, admin, api
components/     ui primitives, composites, charts, shell
db/             schema, migrations runner, seed
drizzle/        SQL migrations
lib/ai/         agents, prompts (versioned _v1), schemas, orchestrator, replay, financial engine
lib/queries.ts  tenant-scoped read models
```

Scripts: `npm run dev`, `npm run build`, `npm run lint`, `npm run type-check`, `npm test` (financial engine), `npm run db:generate`.

See `DESIGN.md` for the design system and `docs/BUILD_REPORT.md` for the build report.
