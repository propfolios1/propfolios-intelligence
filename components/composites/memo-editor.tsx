"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
 * Three columns: data sources, a 680px sheet of white paper with a faint grain,
 * and a rail of suggestions, fact-check flags and citations. The toolbar only
 * exists while text is selected. Type / for blocks.
 */
export function MemoEditor({
  memoId,
  version: initialVersion,
  initialHtml,
  readOnly,
  dataSources,
  citations,
  flags,
}: {
  memoId: string;
  version: number;
  initialHtml: string;
  readOnly?: boolean;
  dataSources: MemoDataSection[];
  citations: MemoCitation[];
  flags: MemoFlag[];
}) {
  const [saved, setSaved] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | false>(false);
  const versionRef = React.useRef(initialVersion);
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
      const res = await fetch(`/api/memos/${memoId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentHtml: html, version: versionRef.current }) });
      const json = await res.json().catch(() => ({}));
      setSaveError(res.ok ? false : (json.error ?? "Not saved. Retry."));
      if (res.ok) {
        versionRef.current = json.version;
        setSaved(true);
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => setSaved(false), 1500);
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

  return (
    <div className="grid grid-cols-1 gap-12 xl:grid-cols-[minmax(0,680px)_minmax(240px,1fr)] 2xl:grid-cols-[180px_minmax(0,680px)_minmax(220px,1fr)] 2xl:gap-10">
      <SourcesRail sections={dataSources} className="hidden 2xl:block" />

      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-4" data-no-print>
          <span className="flex items-center gap-2 text-small text-ink-500">
            {readOnly ? "Locked after delivery" : (
              <>
                <Kbd>/</Kbd> for blocks · saves automatically
              </>
            )}
          </span>
          <div className="flex items-center gap-3">
            <span className={cn("text-small transition-opacity", saveError ? "text-danger opacity-100" : "text-ink-500", saved || saveError ? "opacity-100 duration-150" : "opacity-0 duration-250")} aria-live="polite">
              {saveError ? saveError : saved ? "Saved" : ""}
            </span>
            {!readOnly && (
              <Button variant="secondary" size="sm" onClick={() => editor && save(editor.getHTML())}>
                Save
              </Button>
            )}
            <Button variant="ghost" size="sm" asChild>
              <a href={`/api/memos/${memoId}/export`} target="_blank" rel="noreferrer">
                Export PDF
              </a>
            </Button>
          </div>
        </div>

        <details className="mb-6 border-y border-hairline 2xl:hidden" data-no-print>
          <summary className="eyebrow flex h-11 cursor-pointer items-center">Data sources</summary>
          <SourcesGrid sections={dataSources} />
        </details>

        <div ref={sheetRef} className="paper-grain relative border border-hairline px-8 py-12 md:px-14 md:py-16">
          {editor ? (
            <>
              <BubbleMenu editor={editor} options={{ placement: "top", offset: 10 }}>
                <div className="flex items-center rounded-sm border border-hairline bg-canvas px-1 py-1">
                  <Tool label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
                    <span className="font-semibold">B</span>
                  </Tool>
                  <Tool label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
                    <span className="font-display italic">I</span>
                  </Tool>
                  <span className="mx-1 h-4 w-px bg-ink-200" />
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
              className="absolute z-30 w-64 rounded-sm border border-hairline bg-canvas py-1 animate-fade"
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
                  className={cn("flex w-full items-center gap-3 px-3 py-2 text-left", i === slash.index && "bg-ink-100")}
                >
                  <span className="num flex w-6 justify-center text-small text-ink-500">{c.glyph}</span>
                  <span className="min-w-0">
                    <span className="block text-small text-ink-900">{c.label}</span>
                    <span className="block truncate text-axis text-ink-500">{c.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <RightRail citations={citations} flags={flags} />
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
      className={cn("flex h-7 min-w-7 items-center justify-center rounded-xs px-1.5 text-small text-ink-700 transition-[color,background-color] duration-120 hover:text-ink-900", active && "bg-ink-100 text-navy-900")}
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
          <span className="mt-6 block h-0.5 w-8 bg-gold-100" />
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
          <div className="eyebrow mb-2 text-ink-500">{s.title}</div>
          {s.items.map((it) => (
            <div key={it.label} className="flex justify-between gap-3 border-t border-hairline py-1.5 text-small">
              <dt className="text-ink-700">{it.label}</dt>
              <dd className="num text-right text-ink-900">{it.value}</dd>
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
        <div key={s.title} className="border-t border-hairline">
          <button
            onClick={() => setOpen((o) => ({ ...o, [s.title]: !o[s.title] }))}
            className="flex h-10 w-full items-center justify-between text-left text-small text-ink-900 transition-[color] duration-120 hover:text-navy-900"
            aria-expanded={open[s.title]}
          >
            {s.title}
            <span className="num text-axis text-ink-500">{open[s.title] ? "−" : "+"}</span>
          </button>
          {open[s.title] && (
            <dl className="pb-4">
              {s.items.map((it) => (
                <div key={it.label} className="flex justify-between gap-2 py-1 text-small">
                  <dt className="truncate text-ink-500">{it.label}</dt>
                  <dd className="num shrink-0 text-right text-ink-900">{it.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      ))}
    </aside>
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

function RightRail({ citations, flags }: { citations: MemoCitation[]; flags: MemoFlag[] }) {
  return (
    <aside className="scrollbar-thin xl:sticky xl:top-20 xl:max-h-[calc(100dvh-104px)] xl:self-start xl:overflow-y-auto" data-no-print>
      <section>
        <div className="eyebrow mb-3">Fact check</div>
        {flags.length === 0 && <p className="text-small text-ink-500">No figures to check.</p>}
        {flags.map((f, i) => (
          <article key={i} className="mb-2 rounded-md border border-hairline bg-surface p-4">
            <div className="flex items-center gap-2">
              <span className={cn("size-1.5 rounded-full", f.severity === "high" ? "bg-danger" : f.severity === "medium" ? "bg-warning" : "bg-success")} aria-hidden />
              <span className="eyebrow">{ISSUE_LABEL[f.issue] ?? f.issue}</span>
            </div>
            <p className="mt-2 text-small font-medium text-ink-900">{f.claim}</p>
            <p className="mt-1 text-small text-ink-700">{f.suggestion}</p>
          </article>
        ))}
      </section>

      <section className="mt-10">
        <div className="eyebrow mb-3">Citations</div>
        {citations.length === 0 && <p className="text-small text-ink-500">No citations in the research dossier.</p>}
        <ol>
          {citations.map((c) => (
            <li key={c.id} className="grid grid-cols-[20px_1fr] gap-2 border-t border-hairline py-2.5 text-small">
              <span className="num text-ink-500">{c.id}</span>
              <span>
                <span className="block text-ink-900">{c.title}</span>
                <span className="text-ink-500">
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
