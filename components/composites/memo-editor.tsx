"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Bold, ChevronRight, Heading2, Italic, List, Quote } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Citation, markCitations } from "./memo-citation";

export interface MemoDataSection {
  title: string;
  items: { label: string; value: string }[];
}
export interface MemoFlag {
  claim: string;
  issue: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
}
export interface MemoCitation {
  id: number;
  title: string;
  source: string;
  date: string;
}

/* ---------------- Slash menu ---------------- */

interface SlashCommand {
  label: string;
  hint: string;
  glyph: string;
  run: (e: Editor) => void;
}

const SLASH: SlashCommand[] = [
  { label: "Text", hint: "Body paragraph", glyph: "¶", run: (e) => e.chain().focus().setParagraph().run() },
  { label: "Section", hint: "Serif heading, opens a section", glyph: "H", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "Subsection", hint: "Smaller serif heading", glyph: "h", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "List", hint: "Ruled list", glyph: "–", run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbered", hint: "01, 02, 03", glyph: "01", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Pull quote", hint: "Set large in serif", glyph: "“", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: "Rule", hint: "Section break", glyph: "―", run: (e) => e.chain().focus().setHorizontalRule().run() },
];

interface SlashState {
  from: number;
  query: string;
  top: number;
  left: number;
  index: number;
}

/**
 * Four columns, Notion meets Stripe: the app navigation, a 280px sources
 * column on ink-50, the editor (white, content at most 720px, 96px from the
 * top) and a 320px AI column on ink-50. No fixed toolbar: formatting appears
 * above a selection. Citations are gold mono superscripts that open their
 * source. Saves on its own and says so for two seconds.
 */
export function MemoEditor({
  memoId,
  version: initialVersion,
  initialHtml,
  readOnly,
  dataSources,
  citations,
  flags,
  title,
  meta,
  actions,
  styleMatch,
  verifiedClaims,
}: {
  memoId: string;
  version: number;
  initialHtml: string;
  readOnly?: boolean;
  dataSources: MemoDataSection[];
  citations: MemoCitation[];
  flags: MemoFlag[];
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  styleMatch: number | null;
  verifiedClaims?: number;
}) {
  const [saved, setSaved] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | false>(false);
  const versionRef = React.useRef(initialVersion);
  const [slash, setSlash] = React.useState<SlashState | null>(null);
  const slashRef = React.useRef<SlashState | null>(null);
  slashRef.current = slash;
  const [cite, setCite] = React.useState<{ id: number; top: number; left: number } | null>(null);
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editorRef = React.useRef<Editor | null>(null);

  const filtered = slash ? SLASH.filter((c) => c.label.toLowerCase().includes(slash.query.toLowerCase())) : [];
  const filteredRef = React.useRef(filtered);
  filteredRef.current = filtered;

  const save = React.useCallback(
    async (html: string) => {
      const res = await fetch(`/api/memos/${memoId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentHtml: html, version: versionRef.current }) });
      const json = await res.json().catch(() => ({}));
      setSaveError(res.ok ? false : (json.error ?? "Not saved. Your edits are kept in this window; retry in a moment."));
      if (res.ok) {
        versionRef.current = json.version;
        setSaved(true);
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => setSaved(false), 2000);
      }
    },
    [memoId],
  );

  const runSlash = React.useCallback((editor: Editor, cmd: SlashCommand) => {
    const s = slashRef.current;
    if (!s) return;
    editor.chain().focus().deleteRange({ from: s.from, to: editor.state.selection.from }).run();
    cmd.run(editor);
    setSlash(null);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Citation, Placeholder.configure({ placeholder: "Write, or type / for a block." })],
    content: markCitations(initialHtml),
    editorProps: {
      attributes: { class: "prose-pf tiptap", "aria-label": "Memo" },
      handleKeyDown: (_view, event) => {
        const s = slashRef.current;
        if (!s) return false;
        const list = filteredRef.current;
        const n = Math.max(list.length, 1);
        if (event.key === "ArrowDown") return setSlash({ ...s, index: (s.index + 1) % n }), true;
        if (event.key === "ArrowUp") return setSlash({ ...s, index: (s.index - 1 + n) % n }), true;
        if (event.key === "Enter") {
          const cmd = list[s.index];
          if (cmd && editorRef.current) runSlash(editorRef.current, cmd);
          else setSlash(null);
          return true;
        }
        if (event.key === "Escape") return setSlash(null), true;
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const { from } = editor.state.selection;
      const $pos = editor.state.selection.$from;
      const before = $pos.parent.textBetween(0, $pos.parentOffset, undefined, "￼");
      const m = before.match(/(?:^|\s)\/([\w ]{0,20})$/);
      if (m && sheetRef.current) {
        const coords = editor.view.coordsAtPos(from);
        const box = sheetRef.current.getBoundingClientRect();
        const start = from - m[1]!.length - 1;
        setSlash((prev) => ({ from: start, query: m[1]!, top: coords.bottom - box.top + 8, left: coords.left - box.left, index: prev && prev.from === start ? prev.index : 0 }));
      } else if (slashRef.current) setSlash(null);

      if (readOnly) return;
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => save(editor.getHTML()), 1200);
    },
  });
  editorRef.current = editor;

  React.useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      clearTimeout(holdTimer.current);
    },
    [],
  );

  React.useEffect(() => {
    if (!cite) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setCite(null);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [cite]);

  const openCitation = (e: React.MouseEvent) => {
    const sup = (e.target as HTMLElement).closest("sup[data-cite]");
    if (!sup || !sheetRef.current) return setCite(null);
    const r = sup.getBoundingClientRect();
    const box = sheetRef.current.getBoundingClientRect();
    setCite({ id: Number(sup.getAttribute("data-cite")), top: r.bottom - box.top + 8, left: Math.max(0, Math.min(r.left - box.left - 12, box.width - 336)) });
  };
  const source = cite ? citations.find((c) => c.id === cite.id) : undefined;
  const cited = new Set([...initialHtml.matchAll(/\[(\d{1,2})\]|data-cite="(\d{1,2})"/g)].map((m) => Number(m[1] ?? m[2])));
  const flagged = flags.filter((f) => f.issue !== "verified").length;

  return (
    <div className="grid min-h-[calc(100dvh-48px)] grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_320px]">
      <SourcesColumn sections={dataSources} citations={citations} className="hidden border-e border-hairline bg-ink-50 lg:block" />

      <div className="relative min-w-0 bg-surface">
        <div className="sticky top-12 z-10 flex h-12 items-center justify-between gap-4 border-b border-hairline bg-surface/95 px-6 backdrop-blur-sm" data-no-print>
          <div className="flex min-w-0 items-center gap-3 text-meta text-ink-500">{meta}</div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn("num text-axis transition-opacity duration-250", saveError ? "text-danger opacity-100" : "text-ink-400", saved || saveError ? "opacity-100" : "opacity-0")} aria-live="polite">
              {saveError ? saveError : saved ? "Saved" : ""}
            </span>
            {readOnly && <span className="text-axis text-ink-400">Locked after delivery</span>}
            {actions ?? (
              <Button variant="ghost" size="sm" asChild>
                <a href={`/api/memos/${memoId}/export`} target="_blank" rel="noreferrer">
                  Export PDF
                </a>
              </Button>
            )}
          </div>
        </div>

        <div ref={sheetRef} onClick={openCitation} className="memo-sheet relative mx-auto max-w-[800px] px-6 pt-12 pb-24 sm:px-10 lg:pt-24">
          <h1 className="mb-6 font-display text-page-sm text-ink-900 md:text-title">{title}</h1>
          {editor ? (
            <>
              <BubbleMenu editor={editor} options={{ placement: "top", offset: 8 }}>
                <div className="flex items-center gap-px rounded-md border border-hairline bg-surface p-1 shadow-drag">
                  <Tool label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <Bold className="size-3.5 stroke-[1.75]" />
                  </Tool>
                  <Tool label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <Italic className="size-3.5 stroke-[1.75]" />
                  </Tool>
                  <span className="mx-1 h-4 w-px bg-hairline" />
                  <Tool label="Section heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                    <Heading2 className="size-3.5 stroke-[1.75]" />
                  </Tool>
                  <Tool label="Pull quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                    <Quote className="size-3.5 stroke-[1.75]" />
                  </Tool>
                  <Tool label="List" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    <List className="size-3.5 stroke-[1.75]" />
                  </Tool>
                </div>
              </BubbleMenu>
              <EditorContent editor={editor} />
            </>
          ) : (
            <MemoSkeleton />
          )}

          {cite && (
            <div role="dialog" aria-label={`Source ${cite.id}`} className="absolute z-30 w-[320px] rounded-md border border-hairline bg-surface p-4 shadow-float animate-fade" style={{ top: cite.top, left: cite.left }}>
              <div className="flex items-baseline gap-2">
                <span className="num text-axis text-gold-600">[{cite.id}]</span>
                <span className="label-caps">Source</span>
              </div>
              {source ? (
                <>
                  <p className="mt-2 text-ui font-medium text-ink-900">{source.title}</p>
                  <p className="mt-1 text-meta text-ink-500">
                    {source.source} · accessed <span className="num">{source.date}</span>
                  </p>
                </>
              ) : (
                <p className="mt-2 text-meta text-ink-500">This reference is not in the research dossier. Re-run research or remove the citation.</p>
              )}
            </div>
          )}

          {slash && editor && filtered.length > 0 && (
            <div
              role="listbox"
              aria-label="Insert block"
              className="absolute z-30 w-64 rounded-md border border-hairline bg-surface p-1 shadow-float animate-fade"
              style={{ top: slash.top, left: Math.max(16, Math.min(slash.left, (sheetRef.current?.clientWidth ?? 600) - 272)) }}
            >
              {filtered.map((c, i) => (
                <button
                  key={c.label}
                  role="option"
                  aria-selected={i === slash.index}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    runSlash(editor, c);
                  }}
                  onMouseEnter={() => setSlash({ ...slash, index: i })}
                  className={cn("flex h-10 w-full items-center gap-3 rounded-sm px-2 text-start", i === slash.index && "bg-ink-100")}
                >
                  <span className="num flex w-6 justify-center text-meta text-ink-500">{c.glyph}</span>
                  <span className="min-w-0">
                    <span className="block text-meta text-ink-900">{c.label}</span>
                    <span className="block truncate text-axis text-ink-500">{c.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-px border-t border-hairline lg:hidden" data-no-print>
          <details className="px-6">
            <summary className="label-caps flex h-12 cursor-pointer items-center">Sources</summary>
            <SourcesColumn sections={dataSources} citations={citations} />
          </details>
        </div>
      </div>

      <AiColumn className="border-t border-hairline bg-ink-50 xl:border-t-0 xl:border-s" styleMatch={styleMatch} flags={flags} flagged={flagged} verifiedClaims={verifiedClaims} citationCount={cited.size} citations={citations.length} />
    </div>
  );
}

function Tool({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("press flex size-8 items-center justify-center rounded-sm text-ink-700 hover:bg-ink-100 hover:text-ink-900", active && "bg-ink-100 text-ink-900")}
    >
      {children}
    </button>
  );
}

/** Mirrors the memo: a title, then sections of heading and paragraphs at their final widths. */
function MemoSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1].map((s) => (
        <div key={s} className={cn(s > 0 && "mt-12")}>
          <Skeleton className="h-6 w-2/5" />
          {[100, 96, 88, 62].map((w, i) => (
            <Skeleton key={i} className="mt-4 h-4" style={{ width: `${w}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Sources: collapsible 32px rows of the figures the memo draws on, then the dossier's citations. */
function SourcesColumn({ sections, citations, className }: { sections: MemoDataSection[]; citations: MemoCitation[]; className?: string }) {
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => Object.fromEntries([...sections.map((s) => [s.title, true]), ["Citations", true]]));
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  return (
    <aside className={cn("lg:sticky lg:top-12 lg:max-h-[calc(100dvh-48px)] lg:self-start lg:overflow-y-auto", className)} data-no-print>
      <div className="label-caps px-4 pt-6 pb-2">Sources</div>
      {sections.map((s) => (
        <div key={s.title}>
          <Row label={s.title} open={open[s.title]} onClick={() => toggle(s.title)} count={s.items.length} />
          {open[s.title] && (
            <dl className="pb-2">
              {s.items.map((it) => (
                <div key={it.label} className="flex h-8 items-center justify-between gap-2 px-4 ps-8 text-meta">
                  <dt className="truncate text-ink-500">{it.label}</dt>
                  <dd className="num shrink-0 text-end text-ink-900">{it.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
      <Row label="Citations" open={open.Citations} onClick={() => toggle("Citations")} count={citations.length} />
      {open.Citations && (
        <ol className="pb-6">
          {citations.length === 0 && <li className="px-4 ps-8 text-meta text-ink-500">The research dossier has no citations.</li>}
          {citations.map((c) => (
            <li key={c.id} className="grid grid-cols-[20px_1fr] gap-2 px-4 py-2 ps-4 text-meta">
              <span className="num text-gold-600">{c.id}</span>
              <span className="min-w-0">
                <span className="block truncate text-ink-900">{c.title}</span>
                <span className="block truncate text-axis text-ink-500">{c.source}</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}

function Row({ label, open, onClick, count }: { label: string; open?: boolean; onClick: () => void; count: number }) {
  return (
    <button onClick={onClick} aria-expanded={open} className="flex h-8 w-full items-center gap-2 px-4 text-start text-ui text-ink-900 transition-colors duration-150 hover:bg-ink-100">
      <ChevronRight className={cn("size-3 shrink-0 stroke-[1.5] text-ink-500 transition-transform duration-150", open && "rotate-90")} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="num text-axis text-ink-400">{count}</span>
    </button>
  );
}

const ISSUE_LABEL: Record<string, string> = {
  unsupported: "Unsupported",
  contradicts_source: "Contradicts source",
  stale: "Stale",
  calculation: "Figure checked",
  missing_citation: "Uncited",
  verified: "Verified",
};

/** AI column: style match, fact check and citation counts, then each flag as a card with a 6px dot. */
function AiColumn({ styleMatch, flags, flagged, verifiedClaims, citationCount, citations, className }: { styleMatch: number | null; flags: MemoFlag[]; flagged: number; verifiedClaims?: number; citationCount: number; citations: number; className?: string }) {
  return (
    <aside className={cn("xl:sticky xl:top-12 xl:max-h-[calc(100dvh-48px)] xl:self-start xl:overflow-y-auto", className)} data-no-print>
      <div className="flex items-center gap-2 px-4 pt-6 pb-2">
        <span className="size-1.5 rounded-full bg-gold-500" aria-hidden />
        <span className="label-caps">Memo agent</span>
      </div>
      <dl className="grid grid-cols-3 border-y border-hairline">
        {[
          ["Style", styleMatch === null ? "None" : `${styleMatch}%`],
          ["Checks", flagged ? `${flagged} open` : `${verifiedClaims ?? flags.length} ok`],
          ["Cited", `${citationCount}/${citations}`],
        ].map(([k, v], i) => (
          <div key={k} className={cn("px-4 py-3", i > 0 && "border-s border-hairline")}>
            <dt className="label-caps truncate">{k}</dt>
            <dd className="num mt-1 text-ui text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="space-y-2 p-4">
        {styleMatch === null && <p className="text-meta text-ink-500">Style match appears once the firm has approved its first memo; the agent learns headings and cadence from it.</p>}
        {flags.map((f, i) => (
          <article key={i} className="rounded-sm border border-hairline bg-surface p-3">
            <div className="flex items-center gap-2">
              <span className={cn("size-1.5 shrink-0 rounded-full", f.severity === "high" ? "bg-danger" : f.severity === "medium" ? "bg-gold-500" : "bg-success")} aria-hidden />
              <span className="label-caps">{ISSUE_LABEL[f.issue] ?? f.issue}</span>
            </div>
            <p className="mt-2 text-meta font-medium text-ink-900">{f.claim}</p>
            <p className="mt-0.5 text-meta text-ink-500">{f.suggestion}</p>
          </article>
        ))}
        {flags.length === 0 && <p className="text-meta text-ink-500">No figures to check in this memo.</p>}
      </div>
    </aside>
  );
}
