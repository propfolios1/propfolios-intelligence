"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import * as React from "react";
import { Button } from "@/components/primitives/button";
import { Kbd } from "@/components/primitives/kbd";
import { Skeleton } from "@/components/primitives/skeleton";
import { cn } from "@/lib/utils";

export interface MemoDataSection {
  title: string;
  items: { label: string; value: string }[];
}
export interface MemoSuggestion {
  kind: string;
  target: string;
  replacement: string;
  reason: string;
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
 * Three columns: data sources, a 680px sheet of white paper with a faint grain,
 * and a rail of suggestions, fact-check flags and citations. The toolbar only
 * exists while text is selected. Type / for blocks.
 */
export function MemoEditor({
  mandateId,
  initialHtml,
  dataSources,
  citations,
  initialSuggestions,
  initialFlags,
}: {
  mandateId: string;
  initialHtml: string;
  dataSources: MemoDataSection[];
  citations: MemoCitation[];
  initialSuggestions: MemoSuggestion[];
  initialFlags: MemoFlag[];
}) {
  const [saved, setSaved] = React.useState(false);
  const [saveError, setSaveError] = React.useState(false);
  const [slash, setSlash] = React.useState<SlashState | null>(null);
  const slashRef = React.useRef<SlashState | null>(null);
  slashRef.current = slash;
  const sheetRef = React.useRef<HTMLDivElement>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editorRef = React.useRef<Editor | null>(null);

  const filtered = slash ? SLASH.filter((c) => c.label.toLowerCase().includes(slash.query.toLowerCase())) : [];
  const filteredRef = React.useRef(filtered);
  filteredRef.current = filtered;

  const save = React.useCallback(
    async (html: string) => {
      const res = await fetch(`/api/mandates/${mandateId}/memo`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ html }) });
      setSaveError(!res.ok);
      if (res.ok) {
        setSaved(true);
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => setSaved(false), 1500);
      }
    },
    [mandateId],
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
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Placeholder.configure({ placeholder: "Write, or type / for a block." })],
    content: initialHtml,
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

  return (
    <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,680px)_minmax(240px,1fr)] 2xl:grid-cols-[180px_minmax(0,680px)_minmax(220px,1fr)] 2xl:gap-10">
      <SourcesRail sections={dataSources} className="hidden 2xl:block" />

      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4" data-no-print>
          <span className="flex items-center gap-2 text-small text-ink-3">
            <Kbd>/</Kbd> for blocks
          </span>
          <div className="flex items-center gap-3">
            <span className={cn("text-small transition-opacity", saveError ? "text-red opacity-100" : "text-ink-3", saved || saveError ? "opacity-100 duration-120" : "opacity-0 duration-300")} aria-live="polite">
              {saveError ? "Not saved. Retry." : saved ? "Saved" : ""}
            </span>
            <Button variant="secondary" size="sm" onClick={() => editor && save(editor.getHTML())}>
              Save
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!editor) return;
                const blob = new Blob([`<html><body>${editor.getHTML()}</body></html>`], { type: "application/msword" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = `${mandateId}-memo.doc`;
                a.click();
                URL.revokeObjectURL(a.href);
              }}
            >
              Word
            </Button>
          </div>
        </div>

        <details className="mb-6 border-y border-rule 2xl:hidden" data-no-print>
          <summary className="eyebrow flex h-11 cursor-pointer items-center">Data sources</summary>
          <SourcesGrid sections={dataSources} />
        </details>

        <div ref={sheetRef} className="paper-grain relative border border-rule px-8 py-12 md:px-14 md:py-16">
          {editor ? (
            <>
              <BubbleMenu editor={editor} options={{ placement: "top", offset: 10 }}>
                <div className="flex items-center rounded-sm border border-rule bg-paper px-1 py-1">
                  <Tool label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <span className="font-semibold">B</span>
                  </Tool>
                  <Tool label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <span className="font-display italic">I</span>
                  </Tool>
                  <span className="mx-1 h-4 w-px bg-rule" />
                  <Tool label="Section heading" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
                    <span className="font-display text-ui">H</span>
                  </Tool>
                  <Tool label="Pull quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
                    <span className="font-display text-ui">“</span>
                  </Tool>
                  <Tool label="List" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
                    –
                  </Tool>
                </div>
              </BubbleMenu>
              <EditorContent editor={editor} />
            </>
          ) : (
            <MemoSkeleton />
          )}

          {slash && editor && filtered.length > 0 && (
            <div
              role="listbox"
              aria-label="Insert block"
              className="absolute z-30 w-64 rounded-sm border border-rule bg-paper py-1 animate-fade"
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
                  className={cn("flex w-full items-center gap-3 px-3 py-2 text-left", i === slash.index && "bg-paper-2")}
                >
                  <span className="num flex w-6 justify-center text-small text-ink-3">{c.glyph}</span>
                  <span className="min-w-0">
                    <span className="block text-small text-ink">{c.label}</span>
                    <span className="block truncate text-axis text-ink-3">{c.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <RightRail mandateId={mandateId} editor={editor} citations={citations} initialSuggestions={initialSuggestions} initialFlags={initialFlags} />
    </div>
  );
}

function Tool({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("flex h-7 min-w-7 items-center justify-center rounded-xs px-1.5 text-small text-ink-2 transition-[color,background-color] duration-120 hover:text-ink", active && "bg-paper-2 text-navy")}
    >
      {children}
    </button>
  );
}

/** Mirrors the memo: a section heading, its gold mark, three paragraphs. */
function MemoSkeleton() {
  return (
    <div aria-hidden>
      {[0, 1].map((s) => (
        <div key={s} className={cn(s > 0 && "mt-12")}>
          <Skeleton className="h-8 w-2/5" />
          <span className="mt-6 block h-0.5 w-8 bg-gold-soft" />
          {[100, 96, 88, 62].map((w, i) => (
            <Skeleton key={i} className="mt-4 h-3.5" style={{ width: `${w}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

function SourcesGrid({ sections }: { sections: MemoDataSection[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-10 gap-y-6 pb-6 md:grid-cols-3">
      {sections.map((s) => (
        <dl key={s.title}>
          <div className="eyebrow mb-2 text-ink-3">{s.title}</div>
          {s.items.map((it) => (
            <div key={it.label} className="flex justify-between gap-3 border-t border-rule py-1.5 text-small">
              <dt className="text-ink-2">{it.label}</dt>
              <dd className="num text-right text-ink">{it.value}</dd>
            </div>
          ))}
        </dl>
      ))}
    </div>
  );
}

function SourcesRail({ sections, className }: { sections: MemoDataSection[]; className?: string }) {
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => Object.fromEntries(sections.map((s, i) => [s.title, i < 3])));
  return (
    <aside className={cn("sticky top-20 self-start", className)}>
      <div className="eyebrow mb-4">Sources</div>
      {sections.map((s) => (
        <div key={s.title} className="border-t border-rule">
          <button
            onClick={() => setOpen((o) => ({ ...o, [s.title]: !o[s.title] }))}
            className="flex h-10 w-full items-center justify-between text-left text-small text-ink transition-[color] duration-120 hover:text-navy"
            aria-expanded={open[s.title]}
          >
            {s.title}
            <span className="num text-axis text-ink-3">{open[s.title] ? "−" : "+"}</span>
          </button>
          {open[s.title] && (
            <dl className="pb-4">
              {s.items.map((it) => (
                <div key={it.label} className="flex justify-between gap-2 py-1 text-small">
                  <dt className="truncate text-ink-3">{it.label}</dt>
                  <dd className="num shrink-0 text-right text-ink">{it.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </aside>
  );
}

const KIND_LABEL: Record<string, string> = { rewrite: "Rewrite", tighten: "Tighten", add_evidence: "Cite", tone: "Tone", structure: "Structure" };
const ISSUE_LABEL: Record<string, string> = {
  unsupported: "Unsupported",
  contradicts_source: "Contradicts source",
  stale: "Stale",
  calculation: "Figure checked",
  missing_citation: "Uncited",
};

function RightRail({
  mandateId,
  editor,
  citations,
  initialSuggestions,
  initialFlags,
}: {
  mandateId: string;
  editor: Editor | null;
  citations: MemoCitation[];
  initialSuggestions: MemoSuggestion[];
  initialFlags: MemoFlag[];
}) {
  const [suggestions, setSuggestions] = React.useState(initialSuggestions);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string>();

  async function refresh() {
    if (!editor) return;
    setLoading(true);
    setError(undefined);
    const sel = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to, " ");
    try {
      const res = await fetch("/api/agents/memo-assist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mandateId, input: { memoHtml: editor.getHTML(), selection: sel || undefined } }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load suggestions.");
      setSuggestions(json.output.suggestions);
    } catch (e) {
      setError((e as Error).message.includes("ANTHROPIC") ? "Suggestions need an Anthropic key." : "Could not load suggestions. Retry.");
    } finally {
      setLoading(false);
    }
  }

  function apply(s: MemoSuggestion) {
    if (!editor) return;
    let applied = false;
    editor.state.doc.descendants((node, pos) => {
      if (applied || !node.isText || !node.text) return;
      const idx = node.text.indexOf(s.target);
      if (idx >= 0) {
        editor.chain().focus().insertContentAt({ from: pos + idx, to: pos + idx + s.target.length }, s.replacement).run();
        applied = true;
      }
    });
    setSuggestions((l) => l.filter((x) => x !== s));
  }

  return (
    <aside className="xl:sticky xl:top-20 xl:max-h-[calc(100dvh-104px)] xl:self-start xl:overflow-y-auto scrollbar-thin" data-no-print>
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <span className="eyebrow">Suggestions</span>
          <button onClick={refresh} disabled={loading} className="text-small text-ink-2 transition-[color] duration-120 hover:text-ink disabled:text-ink-3">
            {loading ? "Reading" : "Refresh"}
          </button>
        </div>
        {error && <p className="mb-3 text-small text-red">{error}</p>}
        {loading
          ? [0, 1].map((i) => (
              <div key={i} className="mb-2 border border-rule p-4">
                <Skeleton className="h-2.5 w-14" />
                <Skeleton className="mt-3 h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-4/5" />
              </div>
            ))
          : suggestions.map((s, i) => (
              <article key={i} className="mb-2 border border-rule p-4">
                <div className="eyebrow text-ink-3">{KIND_LABEL[s.kind] ?? s.kind}</div>
                <p className="mt-2 text-small text-ink-3 line-through decoration-ink-3/60">{s.target}</p>
                <p className="mt-1 text-small text-ink">{s.replacement}</p>
                <p className="mt-2 text-small text-ink-2">{s.reason}</p>
                <div className="mt-3 flex gap-4">
                  <button onClick={() => apply(s)} className="text-small font-medium text-navy underline decoration-rule underline-offset-4 hover:decoration-navy">
                    Apply
                  </button>
                  <button onClick={() => setSuggestions((l) => l.filter((x) => x !== s))} className="text-small text-ink-2 hover:text-ink">
                    Dismiss
                  </button>
                </div>
              </article>
            ))}
        {!loading && suggestions.length === 0 && <p className="text-small text-ink-3">No open suggestions.</p>}
      </section>

      <section className="mt-10">
        <div className="eyebrow mb-3">Fact check</div>
        {initialFlags.map((f, i) => (
          <article key={i} className="mb-2 border border-rule p-4">
            <div className="flex items-center gap-2">
              <span className={cn("size-1.5 rounded-full", f.severity === "high" ? "bg-red" : f.severity === "medium" ? "bg-ink-3" : "bg-green")} aria-hidden />
              <span className="eyebrow text-ink-3">{ISSUE_LABEL[f.issue] ?? f.issue}</span>
            </div>
            <p className="mt-2 font-display text-body leading-[1.35] text-ink">“{f.claim}”</p>
            <p className="mt-2 text-small text-ink-2">{f.suggestion}</p>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <div className="eyebrow mb-3">Citations</div>
        <ol>
          {citations.map((c) => (
            <li key={c.id} className="grid grid-cols-[20px_1fr] gap-2 border-t border-rule py-2.5 text-small">
              <span className="num text-ink-3">{c.id}</span>
              <span>
                <span className="block text-ink">{c.title}</span>
                <span className="text-ink-3">
                  {c.source}, <span className="num">{c.date}</span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
