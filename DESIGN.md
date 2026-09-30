# PropFolios Intelligence: design notes

## Principles

The product is set like a financial broadsheet, not a SaaS dashboard: Instrument Serif carries the headlines, Geist carries the interface, Geist Mono carries every number, and 1px warm rules do the work that cards and shadows do elsewhere. It has two density modes pushed to their extremes: the analyst desk is dense, ruled and instant, while the client portal is calm, spacious and read at 18px. Gold is a signal, never a decoration. It marks the active page, a live agent, a focused row, the section-start rule, the focus ring and the brand rule, and nothing else.

## Five signature details

1. **The Dubai coastline.** The landing page's only illustration is the coast reduced to 12 hairlines: the shoreline, both Palms, the World, the Creek, the Water Canal and Sheikh Zayed Road. A single gold point marks Downtown. The live portfolio card overlaps it and the text column by 24px. `components/illustrations/dubai-coastline.tsx`

2. **The section mark.** In the memo editor and the research dossier, the first paragraph after each heading gets a 32px, 2px gold rule above it, a small editorial mark that says "a section starts here". The editor sheet is the only pure white surface in the product, and it carries a 2% SVG paper grain. `app/styles/editorial.css`

3. **Building elevations instead of photography.** Every property is drawn from its id as a tower, slab or low-rise elevation, with floor lines, mullions and occasionally a crown or mast. They are 36px in tables and 168px in the opportunities catalogue. Nothing is photographed or AI-generated, and no initials sit in coloured circles. `components/illustrations/building-glyph.tsx`

4. **Gold means live.** On the pipeline board, a mandate that an agent touched in the last three hours shows a gold dot with a slow outward ring. The same dot appears in the "Run full flow" progress list and against the running stage in the state-machine ledger. Everything else is ink, navy or rule. `components/primitives/live-dot.tsx`

5. **Receipts, not toasts.**
   - Copying a mandate ID sends a 12px gold dot pulsing out from the exact click point, and "Copied" fades in underneath for 1.2s.
   - Saving a memo writes "Saved" in ink-3 beside the button for 1.5s.
   - Changing the portfolio's currency counts the Instrument Serif hero number to its new value over 400ms. It is the only count-up in the product, and it never runs on load.

   `components/primitives/copy-button.tsx`, `components/composites/portfolio-hero.tsx`

Also built with intent:
- **Command palette.** Rows glide to their new position (150ms FLIP) as the query re-orders them.
- **Kanban drag.** A dragged card lifts 2px with an ink border, and a 2px dashed gold line marks where it will land.
- **Table rows.** A focused row gets a 2px gold bar that slides in from the left.
- **Assistant.** The streaming reply is followed by a 1.5px gold caret blinking at 800ms.
- **Custom charts.** The tornado, the scenario comparison (three IRRs on one shared scale against a dashed hurdle), a plain-SVG five-axis risk radar, and portfolio allocation as a single stacked bar.

## What was deliberately not done

| Banned pattern | What the product does instead |
| --- | --- |
| Centered hero, gradient overlay | Asymmetric 7/5 grid, left-aligned serif headline, one bespoke line drawing |
| Three feature cards with icons | A ruled, numbered index: 01 Research, 02 Underwriting, 03 Monitoring |
| `rounded-2xl` everywhere | Radii are 0, 2, 4 or 12px (palette and tooltips only). Tailwind's radius scale is cleared |
| Welcome greetings, "Let's get started" | "19 mandates in progress. 2 waiting on your review." |
| Grey pulse skeletons | Skeletons shaped like the final layout (the memo skeleton has its gold section marks), with a slow sheen |
| Default shadcn buttons | Rebuilt: 4px radius. Primary hover goes darker (navy to ink) and presses down 0.5px. No leading icons |
| `container mx-auto p-8` | A 1280px measure on a 12-column grid, with 24/48/80px page padding |
| Glassmorphism, neon, gradients | None. The only blur is the modal backdrop, 0 to 8px over 200ms |
| Emoji | None |
| Initial avatars | Removed. The user menu is a name and a role in type |
| Tooltips restating labels | No tooltip primitive ships at all |
| Spinners | None. Running states use the gold live dot |
| Fade-in-on-scroll | Only the landing and sign-in heroes rise once, over 400ms |
| Card shadows | Borders everywhere. Only the modal and the command palette cast a shadow |
| Blue primary | Navy primary. Tailwind's default palette is cleared, so `blue-500` does not exist |
| Decorative icons | 5 Lucide glyphs in the whole product: bell, menu, close, row chevron and row actions. Navigation is text-only |
| "Powered by AI" | Never said. Agents are named for their job: research, underwriting, fact-checker |
| "Simply", "Just", exclamation marks, em dashes, Title Case | Removed from all UI copy and seed data |
| Lorem ipsum, "Coming soon" | Every string is real product copy |

## Decisions and interpretations

- **Button height.** "13px height (not 10)" read as the Tailwind unit: large CTAs are `h-13` (52px), and the default button is 40px so dense analyst headers stay dense.
- **Button hover.** The directive asks for both an instant swap and a 120ms linear background transition. The 120ms linear transition won because it is the more specific rule.
- **2px rules.** The directive reserves them for table headers. They appear on real tables and on ledgers that behave as tables: the audit log, the state-machine timeline, sources and assumptions. Nowhere else.
- **Status pills.** Stages in progress use gold-soft. Gold-soft is the badge colour, and gold text on it stays within the "live" meaning.
- **Two chart colours.** The market price chart dropped Mumbai so it could obey the two-colour rule: Dubai in navy, Abu Dhabi in gold.
- **Dark mode.** Not built, per v1 scope.

## Where the design lives

- `lib/design/tokens.ts`, `typography.ts`, `motion.ts`: typed tokens.
- `app/globals.css`: CSS variables and the Tailwind theme only. Tailwind's default colours, shadows, type sizes and radii are cleared.
- `app/styles/base.css`: element defaults and the `num`, `eyebrow` and `skeleton` utilities.
- `app/styles/editorial.css`: the prose and memo styles.
- `components/primitives/`: Button, Field, Eyebrow, StatusPill, LiveDot, Delta, CopyButton, Segmented, Dialog, DropdownMenu, Popover, Checkbox, Kbd, Skeleton.
- `components/composites/`: PageHeader, StatBlock, DataTable, KanbanBoard, MemoEditor, Assistant, AuditList, DocumentCard, the mandate tabs and the tables.
- `components/charts/`: series (area, line, bar), Tornado, ScenarioComparison, RiskRadar, AllocationBar, Heatmap.
- `components/illustrations/`: DubaiCoastline, EmptyGlyph (mandates, documents, opportunities), BuildingGlyph.

Outside the two token files, the source contains no hex values.

## Screens

All pages were captured at 1440px, from demo data.

### Public

![Landing](docs/design/01-landing.jpg)
![Sign in](docs/design/02-sign-in.jpg)

### Analyst desk

![Today](docs/design/03-analyst-today.jpg)
![Mandates](docs/design/04-mandates.jpg)
![Mandate overview](docs/design/05-mandate-overview.jpg)
![Research](docs/design/06-mandate-research.jpg)
![Underwriting](docs/design/07-mandate-underwriting.jpg)
![Due diligence](docs/design/08-mandate-diligence.jpg)
![Debate](docs/design/09-mandate-debate.jpg)
![Memo](docs/design/10-mandate-memo.jpg)
![Mandate documents](docs/design/11-mandate-documents.jpg)
![Mandate audit](docs/design/12-mandate-audit.jpg)
![Properties](docs/design/13-properties.jpg)
![Developer risk](docs/design/14-developer-risk.jpg)
![Memos](docs/design/15-memos.jpg)
![Market](docs/design/16-market.jpg)

### Client portal

![Portfolio](docs/design/17-client-portfolio.jpg)
![Opportunities](docs/design/18-client-opportunities.jpg)
![Documents](docs/design/19-client-documents.jpg)
![Ask](docs/design/20-client-ask.jpg)
![Recommendations](docs/design/21-client-recommendations.jpg)

### Administration

![Users](docs/design/22-admin-users.jpg)
![Integrations](docs/design/23-admin-integrations.jpg)
![Audit log](docs/design/24-admin-audit.jpg)
![Data](docs/design/25-admin-data.jpg)

### Details

![Command palette](docs/design/d1-command-palette.jpg)
![Kanban drag with the gold drop line](docs/design/d2-kanban-drag.jpg)
![Slash menu](docs/design/d3-slash-menu.jpg)
![Selection toolbar](docs/design/d4-selection-toolbar.jpg)
![Streaming caret](docs/design/d5-streaming-caret.jpg)
![Citation](docs/design/d6-citation.jpg)
![Focused row with the gold bar](docs/design/d7-row-focus.jpg)
![Copy receipt](docs/design/d8-copy.jpg)
![Mobile portfolio](docs/design/m1-mobile-portfolio.jpg)
![Mobile landing](docs/design/m2-mobile-landing.jpg)
