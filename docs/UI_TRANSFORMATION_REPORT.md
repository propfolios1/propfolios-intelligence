# Nakhla UI transformation report

The visual layer of Nakhla was rewritten to the production UI specification: one token set, rewritten primitives and composite components, and page-level rewrites of the dashboards, the mandate, the memo editor, the client portfolio, market, the India desks, sign-in and the landing page. Feature behaviour is unchanged; the 74 unit tests, type-check, lint and production build pass at every commit.

## Commits

| Commit | Scope |
| --- | --- |
| `2663757` | design: apply design tokens everywhere |
| `7fb65e0` | design: rewrite Sidebar to Linear spec, Command Palette to Raycast spec |
| `4bf6a47` | design: rewrite StatCard to Vercel spec |
| `77b7d15` | design: rewrite DataTable to Stripe spec |
| `7da6f72` | design: rewrite EmptyState to Linear spec |
| `badb72b` | design: rewrite Kanban to Linear spec |
| `2632d3b` | design: rewrite charts and modals to spec |
| `f3b4c0e` | design: rewrite Memo Editor to Notion+Stripe spec |
| `e7d2202` | design: rewrite all page headers and the analyst dashboard |
| `f6bad9e` | design: rewrite mandate detail to spec |
| `3d73c66` | design: rewrite client portfolio and market dashboard |
| `f692f65` | design: rewrite India module, auth and landing pages |
| `c223be6` | chore: sweep all copy for institutional tone; remove emojis, greetings, placeholder copy |
| this commit | design: verify every screen; row geometry, spacing scale, report |

Across the transformation, 203 files changed (+3,194, −1,710 lines) before this final commit.

## Verification

All checks ran against the production build (`npm start`) on a fully seeded database. An automated browser pass opened all 80 page URLs (every route, with real ids for dynamic routes) at 1440 by 900 and again at 390 by 844 (iPhone 12). For each page it measured table row heights, navigation row heights, sidebar width, computed box-shadows on static elements, horizontal overflow and console errors. Results are in `docs/screenshots/ui/report.json`.

| Check | Result |
| --- | --- |
| `npm run type-check` | Pass, zero errors |
| `npm run lint` | Pass, zero warnings |
| `npm test` | 74 of 74 pass |
| `npm run build` | Pass at every commit; 93 pages |
| Emoji (Unicode scan of app, components, lib, messages) | 0 |
| `box-shadow` outside the float, modal, palette, toast and drag tokens | 0 in source; 0 static shadows measured in the browser on all 80 pages |
| `border-radius` values | Only 4, 6, 8, 12 and 999px (one 1px tick in the confidence meter's segments) |
| Hard-coded `font-family` | 0 (the favicon SVG aside) |
| Greetings ("Welcome back", "Good afternoon") | 0 |
| Spinners | 0; loading states use shimmer skeletons |
| Console errors | 0 on 80 pages, desktop and mobile |
| Sidebar width | 240px on every page that has one |
| Navigation rows | 32px on every page (0 off spec) |
| Table rows | 562 of 607 rows exactly 40px; the rest are listed under deviations |
| Command palette | Opens on Cmd+K and Ctrl+K (screenshot `00-command-palette.png`) |
| Phone width (390px) | No horizontal overflow on any of the 80 pages |
| Off-scale spacing (6, 10, 14, 18, 28, 36px…) | 90 utilities snapped to the 4/8 scale; two kept where the spec sets the value (button padding 14px, demo badge padding 6px) |

## Design tokens applied

Defined once in `app/globals.css` and exposed to Tailwind; components read only these.

- **Colour:** navy 950, 900, 800, 700, 500, 300, 100, 50; gold 600, 500, 100; ink 900, 800, 700, 500, 400, 300, 200, 100, 50; canvas #FAFAF9; surface #FFFFFF; success, warning, danger, info; hairline rgba(10,31,68,0.08) and row hairline rgba(10,31,68,0.06). State colours appear only as dots, text and thin rules.
- **Type:** Playfair Display for titles (hero 56, page 40 and 32 on phones, section 24); Inter for interface text (card 18, lead 18, body 16, small 14, meta 13, axis 12, label 11 uppercase at 0.08em, hint 10); JetBrains Mono 400 with tabular figures for every number (13 in tables, 32 in stat rows, 48 for the portfolio value). `tailwind-merge` knows the full scale, so a size class never evicts a colour.
- **Spacing:** the 4/8 scale; page gutters 16px on phones, 48px on tablets, 80px on desktop.
- **Radius:** 4 chips, 6 buttons and inputs, 8 cards, 12 modals and the palette, 999 status pills.
- **Elevation:** none on static surfaces (`shadow-card` is `none`); float 0 4px 12px at 6%, modal 0 24px 48px at 16%, palette 0 24px 64px at 20%, toast and drag shadows.
- **Motion:** one curve, cubic-bezier(0.16, 1, 0.3, 1); 150ms hover, 200ms tooltip, 250ms state, 400ms entrance; button press to 98% for 80ms; only opacity, transform and colours animate.
- **Focus:** a 2px gold ring at a 2px offset on every interactive element; the palette field is the only exception, because its caret is the indicator.
- **Dates:** YYYY-MM-DD in tables and metadata (Gulf time), date and 24-hour time for timestamps, relative time in activity feeds, spelled-out dates for documents.

## Components rewritten

| Component | What changed |
| --- | --- |
| Sidebar | 240px, ink-50, a 13px NAKHLA OS or firm wordmark, 32px rows with 16px line icons, a gold left bar on the active row, shortcut chips on hover, a 48px user footer with the account and language menu |
| Top bar | 48px, chevron breadcrumbs, 320px "Search or jump to…" trigger with ⌘K chip, bell, 28px avatar |
| Command palette | 640px at 20% from the top, 64px input, groups across mandates, deals, clients, properties, developers, memos, documents and actions; recent items first; gold-100 match highlight; navigate, close and open hints |
| Button, input, select, textarea, checkbox | 36px, 6px radius, hairline, gold focus ring; primary navy, secondary hairline, ghost, solid danger |
| Status pill and badge | Neutral surface, hairline and a 6px state dot; no tinted fills |
| Toast | Ink-900, white 13px text, 6px radius, no icon, four seconds, gold action link |
| Stat card | A block in a hairline-divided row: label, 32px mono figure, mono delta with triangle, 60 by 20 sparkline |
| Data table and simple table | No outer or cell borders, 32px header, 40px rows with row hairlines, one-line cells ("primary · secondary"), mono right-aligned numbers, ink-50 hover, 8px sort triangles, "1–50 of N · Load more" |
| Kanban | 280px columns, 60px cards, dashed navy-300 drop slot, lift without rotation |
| Empty state | 24px line icon, 18px headline, 14px subtext, primary action, ghost link; illustrations removed |
| Charts | No gridlines, navy-700, navy-500 and ink-400 series, 1.5px lines without dots, navy-100 area fills without strokes, 12px mono axes, hover-only tooltips, no animation |
| Modal | Navy 40% backdrop with blur, 12px radius, modal shadow, Escape closes, an outside click does not |
| Memo editor | Four columns (navigation, 280px sources, 720px editor, 320px AI column), selection-only toolbar, gold mono citation superscripts with a source popover, autosave label, style match, fact checks and citation counts |
| Page header, tabs, cards | 11px eyebrow, Playfair title, 14px ink-500 subtitle, action right; 32px tabs with a 2px gold underline; cards without lift |
| Timeline, activity feed, metric | 32px pipeline steps with state icons; 40px activity rows; figures in mono, names in Inter |

## Copy rewritten

About 140 user-facing strings were added or rewritten and 107 retired. The figures come from comparing string literals in the diff since the token commit.

- All 25 empty states now say what happens next and offer two destinations.
- Buttons are sentence-case verbs, for example "Create mandate".
- The dashboard greeting was replaced with a context subtitle.
- Error messages now say what was not saved and how to recover, including Anthropic rate limits, overload and a refused key.
- About twenty success toasts were removed where the page already shows the outcome.

No emoji, exclamation mark, greeting or marketing superlative remains.

## Screenshots

There are 80 desktop pages at 1440 wide (full page) and 6 phone screenshots at 390 by 844. The command palette and the memo editor have their own images. All are in `docs/screenshots/ui/`.

| No. | Route | Table rows | Rows at 40px | Sidebar 240 | Screenshot |
| --- | --- | --- | --- | --- | --- |
| 01 | `/` | 0 | 0 | n/a | [01-landing.jpg](screenshots/ui/01-landing.jpg) |
| 02 | `/pricing` | 14 | 14 | n/a | [02-pricing.jpg](screenshots/ui/02-pricing.jpg) |
| 03 | `/demo` | 0 | 0 | n/a | [03-demo.jpg](screenshots/ui/03-demo.jpg) |
| 04 | `/admin/dashboard` | 0 | 0 | yes | [04-admin-dashboard.jpg](screenshots/ui/04-admin-dashboard.jpg) |
| 05 | `/admin/ai-control` | 45 | 45 | yes | [05-admin-ai-control.jpg](screenshots/ui/05-admin-ai-control.jpg) |
| 06 | `/admin/audit` | 0 | 0 | yes | [06-admin-audit.jpg](screenshots/ui/06-admin-audit.jpg) |
| 07 | `/admin/automations` | 33 | 33 | yes | [07-admin-automations.jpg](screenshots/ui/07-admin-automations.jpg) |
| 08 | `/admin/billing` | 10 | 10 | yes | [08-admin-billing.jpg](screenshots/ui/08-admin-billing.jpg) |
| 09 | `/admin/branding` | 0 | 0 | yes | [09-admin-branding.jpg](screenshots/ui/09-admin-branding.jpg) |
| 10 | `/admin/commissions` | 28 | 28 | yes | [10-admin-commissions.jpg](screenshots/ui/10-admin-commissions.jpg) |
| 11 | `/admin/commissions/structures` | 0 | 0 | yes | [11-admin-commissions-structures.jpg](screenshots/ui/11-admin-commissions-structures.jpg) |
| 12 | `/admin/compliance` | 0 | 0 | yes | [12-admin-compliance.jpg](screenshots/ui/12-admin-compliance.jpg) |
| 13 | `/admin/data-products` | 0 | 0 | yes | [13-admin-data-products.jpg](screenshots/ui/13-admin-data-products.jpg) |
| 14 | `/admin/insights-config` | 0 | 0 | yes | [14-admin-insights-config.jpg](screenshots/ui/14-admin-insights-config.jpg) |
| 15 | `/admin/integrations` | 7 | 3 | yes | [15-admin-integrations.jpg](screenshots/ui/15-admin-integrations.jpg) |
| 16 | `/admin/invoices` | 5 | 5 | yes | [16-admin-invoices.jpg](screenshots/ui/16-admin-invoices.jpg) |
| 17 | `/admin/invoices/a08aaeb9-d45c-4894-82b0-15b3d5e10dc0` | 8 | 4 | yes | [17-admin-invoices-detail.jpg](screenshots/ui/17-admin-invoices-detail.jpg) |
| 18 | `/admin/kyc` | 5 | 5 | yes | [18-admin-kyc.jpg](screenshots/ui/18-admin-kyc.jpg) |
| 19 | `/admin/kyc/8723661b-e511-5d19-a6ff-38948bad2c89` | 10 | 10 | yes | [19-admin-kyc-detail.jpg](screenshots/ui/19-admin-kyc-detail.jpg) |
| 20 | `/admin/reports` | 10 | 5 | yes | [20-admin-reports.jpg](screenshots/ui/20-admin-reports.jpg) |
| 21 | `/admin/seed` | 0 | 0 | yes | [21-admin-seed.jpg](screenshots/ui/21-admin-seed.jpg) |
| 22 | `/admin/users` | 45 | 31 | yes | [22-admin-users.jpg](screenshots/ui/22-admin-users.jpg) |
| 23 | `/notifications` | 0 | 0 | yes | [23-notifications.jpg](screenshots/ui/23-notifications.jpg) |
| 24 | `/analyst/dashboard` | 0 | 0 | yes | [24-analyst-dashboard.jpg](screenshots/ui/24-analyst-dashboard.jpg) |
| 25 | `/analyst/ai-memory` | 23 | 23 | yes | [25-analyst-ai-memory.jpg](screenshots/ui/25-analyst-ai-memory.jpg) |
| 26 | `/analyst/assistant` | 0 | 0 | yes | [26-analyst-assistant.jpg](screenshots/ui/26-analyst-assistant.jpg) |
| 27 | `/analyst/benchmarks` | 9 | 9 | yes | [27-analyst-benchmarks.jpg](screenshots/ui/27-analyst-benchmarks.jpg) |
| 28 | `/analyst/clients` | 0 | 0 | yes | [28-analyst-clients.jpg](screenshots/ui/28-analyst-clients.jpg) |
| 29 | `/analyst/clients/8723661b-e511-5d19-a6ff-38948bad2c89` | 4 | 4 | yes | [29-analyst-clients-detail.jpg](screenshots/ui/29-analyst-clients-detail.jpg) |
| 30 | `/analyst/commissions` | 13 | 13 | yes | [30-analyst-commissions.jpg](screenshots/ui/30-analyst-commissions.jpg) |
| 31 | `/analyst/deals` | 10 | 10 | yes | [31-analyst-deals.jpg](screenshots/ui/31-analyst-deals.jpg) |
| 32 | `/analyst/deals/e1240a62-fa0a-4102-ad02-3771d08c152c` | 4 | 2 | yes | [32-analyst-deals-detail.jpg](screenshots/ui/32-analyst-deals-detail.jpg) |
| 33 | `/analyst/developers` | 23 | 23 | yes | [33-analyst-developers.jpg](screenshots/ui/33-analyst-developers.jpg) |
| 34 | `/analyst/federation` | 2 | 0 | yes | [34-analyst-federation.jpg](screenshots/ui/34-analyst-federation.jpg) |
| 35 | `/analyst/india` | 28 | 28 | yes | [35-analyst-india.jpg](screenshots/ui/35-analyst-india.jpg) |
| 36 | `/analyst/india/goa` | 12 | 12 | yes | [36-analyst-india-goa.jpg](screenshots/ui/36-analyst-india-goa.jpg) |
| 37 | `/analyst/india/mumbai` | 15 | 15 | yes | [37-analyst-india-mumbai.jpg](screenshots/ui/37-analyst-india-mumbai.jpg) |
| 38 | `/analyst/india/records/0770f421-a276-5356-ae61-a89ed7696e29` | 2 | 2 | yes | [38-analyst-india-records-detail.jpg](screenshots/ui/38-analyst-india-records-detail.jpg) |
| 39 | `/analyst/india/tax-calculator` | 2 | 2 | yes | [39-analyst-india-tax-calculator.jpg](screenshots/ui/39-analyst-india-tax-calculator.jpg) |
| 40 | `/analyst/insights` | 0 | 0 | yes | [40-analyst-insights.jpg](screenshots/ui/40-analyst-insights.jpg) |
| 41 | `/analyst/mandates` | 0 | 0 | yes | [41-analyst-mandates.jpg](screenshots/ui/41-analyst-mandates.jpg) |
| 42 | `/analyst/mandates/78adf75c-110e-55c7-a4a1-7fd5854311c2` | 0 | 0 | yes | [42-analyst-mandates-detail.jpg](screenshots/ui/42-analyst-mandates-detail.jpg) |
| 43 | `/analyst/mandates/78adf75c-110e-55c7-a4a1-7fd5854311c2?ta…` | 0 | 0 | yes | [43-analyst-mandates-detail-tab-debate.jpg](screenshots/ui/43-analyst-mandates-detail-tab-debate.jpg) |
| 44 | `/analyst/mandates/78adf75c-110e-55c7-a4a1-7fd5854311c2/jo…` | 0 | 0 | yes | [44-analyst-mandates-detail-journey.jpg](screenshots/ui/44-analyst-mandates-detail-journey.jpg) |
| 45 | `/analyst/mandates/new` | 0 | 0 | yes | [45-analyst-mandates-new.jpg](screenshots/ui/45-analyst-mandates-new.jpg) |
| 46 | `/analyst/market` | 4 | 4 | yes | [46-analyst-market.jpg](screenshots/ui/46-analyst-market.jpg) |
| 47 | `/analyst/memos` | 2 | 2 | yes | [47-analyst-memos.jpg](screenshots/ui/47-analyst-memos.jpg) |
| 48 | `/analyst/memos/5281454c-275d-504d-ac3a-fec7f8ee5cb9` | 0 | 0 | yes | [48-analyst-memos-detail.jpg](screenshots/ui/48-analyst-memos-detail.jpg) |
| 49 | `/analyst/properties` | 50 | 50 | yes | [49-analyst-properties.jpg](screenshots/ui/49-analyst-properties.jpg) |
| 50 | `/analyst/properties/burj-crown` | 12 | 12 | yes | [50-analyst-properties-burj-crown.jpg](screenshots/ui/50-analyst-properties-burj-crown.jpg) |
| 51 | `/analyst/settings` | 0 | 0 | yes | [51-analyst-settings.jpg](screenshots/ui/51-analyst-settings.jpg) |
| 52 | `/client/portfolio` | 4 | 4 | yes | [52-client-portfolio.jpg](screenshots/ui/52-client-portfolio.jpg) |
| 53 | `/client/assistant` | 0 | 0 | yes | [53-client-assistant.jpg](screenshots/ui/53-client-assistant.jpg) |
| 54 | `/client/deals` | 0 | 0 | yes | [54-client-deals.jpg](screenshots/ui/54-client-deals.jpg) |
| 55 | `/client/deals/92beed16-6288-4ab7-93a1-119cff704483` | 2 | 2 | yes | [55-client-deals-detail.jpg](screenshots/ui/55-client-deals-detail.jpg) |
| 56 | `/client/documents` | 0 | 0 | yes | [56-client-documents.jpg](screenshots/ui/56-client-documents.jpg) |
| 57 | `/client/goals` | 0 | 0 | yes | [57-client-goals.jpg](screenshots/ui/57-client-goals.jpg) |
| 58 | `/client/india` | 2 | 2 | yes | [58-client-india.jpg](screenshots/ui/58-client-india.jpg) |
| 59 | `/client/insights` | 0 | 0 | yes | [59-client-insights.jpg](screenshots/ui/59-client-insights.jpg) |
| 60 | `/client/invoices` | 8 | 0 | yes | [60-client-invoices.jpg](screenshots/ui/60-client-invoices.jpg) |
| 61 | `/client/market-insights` | 0 | 0 | yes | [61-client-market-insights.jpg](screenshots/ui/61-client-market-insights.jpg) |
| 62 | `/client/messages` | 0 | 0 | yes | [62-client-messages.jpg](screenshots/ui/62-client-messages.jpg) |
| 63 | `/client/nri` | 0 | 0 | yes | [63-client-nri.jpg](screenshots/ui/63-client-nri.jpg) |
| 64 | `/client/opportunities` | 0 | 0 | yes | [64-client-opportunities.jpg](screenshots/ui/64-client-opportunities.jpg) |
| 65 | `/client/private-banking` | 0 | 0 | yes | [65-client-private-banking.jpg](screenshots/ui/65-client-private-banking.jpg) |
| 66 | `/client/recommendations` | 0 | 0 | yes | [66-client-recommendations.jpg](screenshots/ui/66-client-recommendations.jpg) |
| 67 | `/client/reports` | 0 | 0 | yes | [67-client-reports.jpg](screenshots/ui/67-client-reports.jpg) |
| 68 | `/client/settings` | 0 | 0 | yes | [68-client-settings.jpg](screenshots/ui/68-client-settings.jpg) |
| 69 | `/client/statements` | 12 | 12 | yes | [69-client-statements.jpg](screenshots/ui/69-client-statements.jpg) |
| 70 | `/client/tax-documents` | 6 | 6 | yes | [70-client-tax-documents.jpg](screenshots/ui/70-client-tax-documents.jpg) |
| 71 | `/notifications` | 0 | 0 | yes | [71-notifications.jpg](screenshots/ui/71-notifications.jpg) |
| 72 | `/platform/dashboard` | 5 | 5 | yes | [72-platform-dashboard.jpg](screenshots/ui/72-platform-dashboard.jpg) |
| 73 | `/platform/agents` | 54 | 54 | yes | [73-platform-agents.jpg](screenshots/ui/73-platform-agents.jpg) |
| 74 | `/platform/bi` | 22 | 18 | yes | [74-platform-bi.jpg](screenshots/ui/74-platform-bi.jpg) |
| 75 | `/platform/federation` | 2 | 0 | yes | [75-platform-federation.jpg](screenshots/ui/75-platform-federation.jpg) |
| 76 | `/platform/federation/dashboard` | 12 | 12 | yes | [76-platform-federation-dashboard.jpg](screenshots/ui/76-platform-federation-dashboard.jpg) |
| 77 | `/platform/metrics` | 38 | 38 | yes | [77-platform-metrics.jpg](screenshots/ui/77-platform-metrics.jpg) |
| 78 | `/platform/tenants` | 5 | 5 | yes | [78-platform-tenants.jpg](screenshots/ui/78-platform-tenants.jpg) |
| 79 | `/platform/tenants/96cd10e7-61f1-5013-ad30-576016292bbe` | 0 | 0 | yes | [79-platform-tenants-detail.jpg](screenshots/ui/79-platform-tenants-detail.jpg) |
| 80 | `/platform/tenants/new` | 0 | 0 | yes | [80-platform-tenants-new.jpg](screenshots/ui/80-platform-tenants-new.jpg) |

Phone (iPhone 12): [landing](screenshots/ui/m-01-landing.jpg), [analyst dashboard](screenshots/ui/m-24-analyst-dashboard.jpg), [mandate](screenshots/ui/m-42-analyst-mandates-detail.jpg), [market](screenshots/ui/m-46-analyst-market.jpg), [client portfolio](screenshots/ui/m-52-client-portfolio.jpg), [AI control](screenshots/ui/m-05-admin-ai-control.jpg). Interactions: [command palette](screenshots/ui/00-command-palette.png), [memo editor](screenshots/ui/00-memo-editor.png).

## Known remaining deviations from the spec

1. **Row heights.** 45 of 607 measured rows are not exactly 40px, all in secondary tables:
- `/admin/integrations`: 4 of 7 rows
- `/admin/invoices/a08aaeb9-d45c-4894-82b0-15b3d5e10dc0`: 4 of 8 rows
- `/admin/reports`: 5 of 10 rows
- `/admin/users`: 14 of 45 rows
- `/analyst/deals/e1240a62-fa0a-4102-ad02-3771d08c152c`: 2 of 4 rows
- `/analyst/federation`: 2 of 2 rows
- `/client/invoices`: 8 of 8 rows
- `/platform/bi`: 4 of 22 rows
- `/platform/federation`: 2 of 2 rows

   These are invoice line items with long descriptions, two-row federation baselines, the permission matrix (whose sticky first column carries a background), integrations with status text, report rows carrying two buttons, and the deal detail's offer table.
2. **Kanban card content.** The spec asks for a 60px card with three lines (client, property, footer). Three lines do not fit in 60px at the specified sizes, so the card keeps 60px with two lines: client with the state dot and time in stage, then property with the reference.
3. **Row selection.** DataTable has no checkbox column, because no screen has a bulk action to perform. Row actions and keyboard focus are implemented.
4. **Nav item gap and button padding.** The spec gives 10px between nav icon and label and 14px horizontal button padding, while also banning 10px and 14px on the spacing scale. The nav uses 12px; the button keeps 14px.
5. **Building glyphs.** The small generated building glyphs remain on property cards and the property detail page. They are product identifiers, not empty-state illustrations, and were removed from every table.
6. **DEMO MODE badge.** It uses a gold ground as the spec requires, the one deliberate exception to "no colour-tinted backgrounds".
7. **Translations.** Navigation, breadcrumbs, page titles and the shell are translated into Arabic, Hindi, Marathi and Konkani; page body copy is English.
8. **Skeletons.** Route-level `loading.tsx` files share one skeleton (header, stat row, table) rather than a bespoke skeleton per page, so some pages' skeletons only approximate their final layout.
9. **Toast actions.** The single gold action link is supported by the toaster, but no current toast needs one.

## What still needs polish

- **Invoice detail.** Long line-item descriptions wrap; give them a description column with truncation and a tooltip, so rows hold 40px.
- **Federation baselines** (`/analyst/federation`, `/platform/federation`). Each segment shows a median above its range in two lines; split them into two columns.
- **Permission matrix** on `/admin/users`. Rows are 44px because of the sticky label column; set an explicit line-height on the dot cells.
- **Insight rows** on the dashboard. They keep a small icon tile and two lines; a 40px single-line variant would match the activity feed beside them.
- **Scenario cards** on the mandate overview. Their label column wraps at 1440px ("Equity multiple" over two lines); widen the value column or move the labels above the values.
- **Charts.** Value axes stay on the right in 12px mono; a left-aligned axis was not tested against the spec's reading order.
- **Arabic.** The right-to-left layout was checked on the shell and the deals list only; check the memo editor, charts and the Kanban in Arabic.
- **Per-page skeletons.** Write `loading.tsx` skeletons for the mandate, memo editor and portfolio that match those layouts exactly.
