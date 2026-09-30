# PropFolios Intelligence

Institutional real estate advisory platform for HNW investors deploying into UAE and India real estate. It covers the analyst mandate pipeline, 12 Claude agents (research → underwriting → due diligence → debate → memo → fact-check), and a client portal with portfolio monitoring and a streaming assistant.

## Quick start

```bash
npm install
cp .env.example .env.local   # every key is optional
npm run dev                  # http://localhost:3000
```

Without keys the app runs in **demo mode**: no auth, seeded data, and the client assistant streams a canned reply. Add keys to turn on each integration:

| Variable | Enables |
| --- | --- |
| `ANTHROPIC_API_KEY` | All agents (`Run Full Flow`, memo suggestions) and the live assistant |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk sign-in. `/analyst`, `/client`, `/admin` and the agent APIs become protected |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Branded Mapbox map with clustered pins (otherwise a vector fallback) |

## Layout

```
app/                    routes: landing, sign-in, analyst/*, client/*, admin/*, api/*
components/ui/          shadcn primitives, restyled to the design system
components/             PageHeader, StatCard, DataTable, KanbanBoard, MemoEditor, Assistant,
                        EmptyState, BrandMark, charts; shell/ holds SidebarNav, TopBar, CommandPalette
lib/ai/define-agent.ts  agent runtime: streaming, structured output, zod validation + retry, cost → audit log
lib/ai/agents/          research, market-intel, developer-risk, underwriting, due-diligence,
                        bull, bear, judge, memo-writer, fact-checker, portfolio-monitor, recommendation
                        (+ memo-assist for the editor's suggestion rail)
lib/ai/orchestrator.ts  full mandate state machine, streamed to the UI as NDJSON
lib/data/               types, deterministic seed data, repository (store.ts)
```

## Agents

Each agent is built with `defineAgent({ name, inputSchema, outputSchema, system, prompt, effort })` and exposes `run(input, ctx)`. A run:

1. validates the input with zod,
2. streams `claude-opus-5-5` with adaptive thinking, structured JSON output and the server-side refusal fallback (`fallbacks: "default"`),
3. validates the result against the output schema, and sends one append-only correction turn if validation fails,
4. writes tokens, cost and duration to the audit log.

To run one agent directly, `POST /api/agents/{name}` with `{ "input": {...}, "mandateId": "MND-2041" }`.

## Data

`lib/data/store.ts` is the single repository. It serves seed data merged with in-memory agent results, stage moves and memo edits. You can reset these from **Admin → Data & seed**. Swap its internals for a database without touching callers.

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck`
