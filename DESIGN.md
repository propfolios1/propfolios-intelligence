# PropFolios Intelligence: design system

Institutional, quiet and exact. The interface reads like an investment committee pack: serif headlines, a clean sans for the interface, mono for every figure, and navy as the voice of the brand. Gold is an accent used on less than 5% of any screen: the active navigation bar, the live-agent dot, the focus ring, the brand rule and the gold mark under memo headings.

## Tokens

Defined once in `app/globals.css` (`:root` and `@theme`) and mirrored in `lib/design/tokens.ts` for charts and the PDF.

| Group | Values |
| --- | --- |
| Navy | 900 `#0A1F44` · 800 `#0F2A5C` · 700 `#1A3A6B` · 100 `#E8EDF5` · 50 `#F4F6FA` |
| Gold | 600 `#A8894A` · 500 `#C9A961` · 100 `#F5EDDA` |
| Ink | 900 `#0A0A0A` · 700 `#374151` · 500 `#6B7280` · 400 `#9CA3AF` · 200 `#E5E7EB` · 100 `#F3F4F6` |
| Surfaces | background `#FAFAF9` · surface `#FFFFFF` |
| Status | success `#059669` · warning `#D97706` · danger `#DC2626` |
| Type scale | 56 / 40 / 32 / 24 / 18 / 16 / 14 / 12 |
| Radius | 6 buttons and inputs · 8 cards · 12 modals · 999 pills |
| Borders | 1px `ink-200`. Never 2px. |
| Shadows | two only: `shadow-card` and `shadow-float` |
| Motion | 150 / 250 / 400 ms on `cubic-bezier(0.16, 1, 0.3, 1)`. No spinners; skeletons and the live dot carry waiting states. |
| Focus | 2px gold outline, 2px offset, on every interactive element |

## Type

- Playfair Display (400, 500, 600): page titles, card titles in display contexts, memo headings.
- Inter: all interface text.
- JetBrains Mono: references, figures, axes, costs, timestamps.

## Copy

Formal and institutional. "Create Mandate", "Allocation Memo", "Due Diligence Findings". No emojis, no exclamation marks, no marketing adjectives. Errors say what happened and what to do next.

## Components

`components/ui` holds restyled primitives (Radix and cmdk under the hood). `components/composites` holds the product components: PageHeader, StatCard (with sparkline), DataTable (sortable, keyboard navigable, cards on mobile), KanbanBoard (vertical on mobile, optimistic moves), MemoEditor (TipTap, versioned autosave), Assistant (streaming, cited), StatusPill, SeverityBadge, Metric, ScenarioCards, Timeline, PropertyCard, DocumentCard, ActivityFeed, EmptyState. Charts live in `components/charts` (RiskRadar, CashFlowChart with a subtle gradient, Tornado, series). The shell (`components/shell`) provides the 240px SidebarNav, the 56px TopBar, the Cmd+K CommandPalette and Cmd+/ KeyboardShortcuts.

Screenshots of every major screen are in `docs/screenshots`.
