"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  AlertTriangle,
  Bold,
  ChevronDown,
  Database,
  Download,
  FileDown,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sparkles,
  Type,
  type LucideIcon,
} from "lucide-react";
import * as React from "react";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
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
  icon: LucideIcon;
  run: (e: Editor) => void;
}

const SLASH: SlashCommand[] = [
  { label: "Text", hint: "Plain paragraph", icon: Type, run: (e) => e.chain().focus().setParagraph().run() },
  { label: "Heading", hint: "Section heading", icon: Heading2, run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: "Subheading", hint: "Smaller heading", icon: Heading3, run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: "Bullet list", hint: "Unordered list", icon: List, run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: "Numbered list", hint: "Ordered list", icon: ListOrdered, run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: "Quote", hint: "Pull quote", icon: Quote, run: (e) => e.chain().focus().toggleBlockquote().run() },
  { label: "Divider", hint: "Horizontal rule", icon: Minus, run: (e) => e.chain().focus().setHorizontalRule().run() },
];

interface SlashState {
  from: number;
  query: string;
  top: number;
  left: number;
  index: number;
}

/* ---------------- Editor ---------------- */

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
  const [saved, setSaved] = React.useState<"idle" | "saving" | "saved">("idle");
  const [slash, setSlash] = React.useState<SlashState | null>(null);
  const slashRef = React.useRef<SlashState | null>(null);
  slashRef.current = slash;
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const saveTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const fadeTimer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const filtered = slash ? SLASH.filter((c) => c.label.toLowerCase().includes(slash.query.toLowerCase())) : [];
  const filteredRef = React.useRef(filtered);
  filteredRef.current = filtered;

  const runSlash = React.useCallback((editor: Editor, cmd: SlashCommand) => {
    const s = slashRef.current;
    if (!s) return;
    editor.chain().focus().deleteRange({ from: s.from, to: editor.state.selection.from }).run();
    cmd.run(editor);
    setSlash(null);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } }), Placeholder.configure({ placeholder: "Start writing, or type / for commands…" })],
    content: initialHtml,
    editorProps: {
      attributes: { class: "prose-pf prose-lg-pf tiptap", "aria-label": "Memo editor" },
      handleKeyDown: (view, event) => {
        const s = slashRef.current;
        if (!s) return false;
        const list = filteredRef.current;
        if (event.key === "ArrowDown") {
          setSlash({ ...s, index: (s.index + 1) % Math.max(list.length, 1) });
          return true;
        }
        if (event.key === "ArrowUp") {
          setSlash({ ...s, index: (s.index - 1 + list.length) % Math.max(list.length, 1) });
          return true;
        }
        if (event.key === "Enter") {
          const cmd = list[s.index];
          if (cmd && editorRef.current) runSlash(editorRef.current, cmd);
          else setSlash(null);
          return true;
        }
        if (event.key === "Escape") {
          setSlash(null);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      // Slash detection: "/" at the start of a block or after whitespace.
      const { from } = editor.state.selection;
      const $pos = editor.state.selection.$from;
      const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, undefined, "￼");
      const m = textBefore.match(/(?:^|\s)\/([\w ]{0,20})$/);
      if (m && wrapRef.current) {
        const coords = editor.view.coordsAtPos(from);
        const box = wrapRef.current.getBoundingClientRect();
        const start = from - m[1]!.length - 1;
        setSlash((prev) => ({
          from: start,
          query: m[1]!,
          top: coords.bottom - box.top + 6,
          left: coords.left - box.left,
          index: prev && prev.from === start ? Math.min(prev.index, SLASH.length - 1) : 0,
        }));
      } else if (slashRef.current) {
        setSlash(null);
      }

      // Debounced auto-save.
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaved("saving");
        const res = await fetch(`/api/mandates/${mandateId}/memo`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ html: editor.getHTML() }),
        });
        if (res.ok) {
          setSaved("saved");
          clearTimeout(fadeTimer.current);
          fadeTimer.current = setTimeout(() => setSaved("idle"), 2000);
        } else {
          setSaved("idle");
        }
      }, 900);
    },
  });
  const editorRef = React.useRef<Editor | null>(null);
  editorRef.current = editor;

  React.useEffect(() => () => {
    clearTimeout(saveTimer.current);
    clearTimeout(fadeTimer.current);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[240px_minmax(0,1fr)_300px]">
      <div className="xl:hidden 2xl:block">
        <LeftRail sections={dataSources} />
      </div>

      <div className="relative min-w-0">
        <details className="mb-6 hidden rounded-card border border-ink-200 bg-surface xl:block 2xl:hidden">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-900">Data sources</summary>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4 px-4 pb-4">
            {dataSources.map((s) => (
              <dl key={s.title} className="space-y-1.5">
                <div className="eyebrow">{s.title}</div>
                {s.items.map((it) => (
                  <div key={it.label} className="flex justify-between gap-3 text-xs">
                    <dt className="text-ink-500">{it.label}</dt>
                    <dd className="num text-right text-ink-900">{it.value}</dd>
                  </div>
                ))}
              </dl>
            ))}
          </div>
        </details>
        <div className="mb-6 flex items-center justify-between gap-4">
          <span className="text-xs text-ink-500">
            Type <kbd className="num rounded-[3px] border border-ink-200 px-1">/</kbd> for commands · select text to format
          </span>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "num rounded-full bg-ink-100 px-2.5 py-0.5 text-[11px] text-ink-600 transition-opacity duration-400",
                saved === "idle" ? "opacity-0" : "opacity-100",
              )}
              aria-live="polite"
            >
              {saved === "saving" ? "Saving…" : "Saved"}
            </span>
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <FileDown /> PDF
            </Button>
            <Button
              variant="secondary"
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
              <Download /> Word
            </Button>
          </div>
        </div>

        <div ref={wrapRef} className="relative mx-auto max-w-[720px] rounded-card border border-ink-200 bg-surface px-8 py-10 md:px-12 md:py-14">
          {editor ? (
            <>
              <BubbleMenu editor={editor} options={{ placement: "top", offset: 8 }}>
                <div className="flex items-center gap-0.5 rounded-control border border-ink-200 bg-surface p-1 shadow-float">
                  <ToolbarButton label="Bold" icon={Bold} active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} />
                  <ToolbarButton label="Italic" icon={Italic} active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} />
                  <span className="mx-0.5 h-5 w-px bg-ink-200" />
                  <ToolbarButton label="Heading" icon={Heading2} active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} />
                  <ToolbarButton label="Subheading" icon={Heading3} active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} />
                  <ToolbarButton label="Bullet list" icon={List} active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} />
                  <ToolbarButton label="Quote" icon={Quote} active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} />
                </div>
              </BubbleMenu>
              <EditorContent editor={editor} />
            </>
          ) : (
            <div className="space-y-4">
              <Skeleton className="h-7 w-2/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="mt-8 h-7 w-1/3" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {slash && editor && filtered.length > 0 && (
            <div
              role="listbox"
              aria-label="Insert block"
              className="absolute z-30 w-64 rounded-card border border-ink-200 bg-surface p-1 shadow-float animate-fade-in"
              style={{ top: slash.top, left: Math.min(slash.left, (wrapRef.current?.clientWidth ?? 600) - 270) }}
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
                  className={cn("flex w-full items-center gap-3 rounded-[4px] px-2.5 py-2 text-left", i === slash.index && "bg-ink-100")}
                >
                  <span className="flex size-7 items-center justify-center rounded-control border border-ink-200 bg-surface">
                    <c.icon className="size-3.5 text-ink-600" />
                  </span>
                  <span>
                    <span className="block text-sm text-ink-900">{c.label}</span>
                    <span className="block text-[11px] text-ink-500">{c.hint}</span>
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

function ToolbarButton({ label, icon: Icon, active, onClick }: { label: string; icon: LucideIcon; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn("flex size-8 items-center justify-center rounded-[4px] text-ink-600 transition-colors hover:bg-ink-100", active && "bg-navy-100 text-navy-900")}
    >
      <Icon className="size-4" />
    </button>
  );
}

/* ---------------- Rails ---------------- */

function LeftRail({ sections }: { sections: MemoDataSection[] }) {
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => Object.fromEntries(sections.map((s, i) => [s.title, i < 2])));
  return (
    <aside className="2xl:sticky 2xl:top-32 2xl:self-start">
      <div className="eyebrow mb-3 flex items-center gap-2">
        <Database className="size-3.5" /> Data sources
      </div>
      <div className="divide-y divide-ink-200 rounded-card border border-ink-200 bg-surface">
        {sections.map((s) => (
          <div key={s.title}>
            <button
              onClick={() => setOpen((o) => ({ ...o, [s.title]: !o[s.title] }))}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-ink-900 hover:bg-ink-50"
              aria-expanded={open[s.title]}
            >
              {s.title}
              <ChevronDown className={cn("size-4 text-ink-400 transition-transform duration-150", open[s.title] && "rotate-180")} />
            </button>
            {open[s.title] && (
              <dl className="space-y-2 px-4 pb-4">
                {s.items.map((it) => (
                  <div key={it.label} className="flex justify-between gap-3 text-xs">
                    <dt className="text-ink-500">{it.label}</dt>
                    <dd className="num text-right text-ink-900">{it.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

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
  const [flags] = React.useState(initialFlags);
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
      if (!res.ok) throw new Error(json.error ?? "Failed");
      setSuggestions(json.output.suggestions);
    } catch (e) {
      setError((e as Error).message);
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
    setSuggestions((list) => list.filter((x) => x !== s));
  }

  return (
    <aside className="space-y-8 xl:sticky xl:top-32 xl:max-h-[calc(100dvh-160px)] xl:self-start xl:overflow-y-auto scrollbar-thin">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow flex items-center gap-2">
            <Sparkles className="size-3.5 text-gold-600" /> AI suggestions
          </span>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            {loading ? "Thinking…" : "Refresh"}
          </Button>
        </div>
        {error && <p className="mb-2 text-xs text-negative">{error}</p>}
        <div className="space-y-2">
          {loading
            ? [0, 1].map((i) => (
                <div key={i} className="rounded-card border border-ink-200 bg-surface p-3">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2 h-3 w-full" />
                  <Skeleton className="mt-1.5 h-3 w-4/5" />
                </div>
              ))
            : suggestions.map((s, i) => (
                <div key={i} className="rounded-card border border-ink-200 bg-surface p-3">
                  <div className="eyebrow">{s.kind.replace("_", " ")}</div>
                  <p className="mt-1.5 text-xs text-ink-500 line-through decoration-ink-300">{s.target}</p>
                  <p className="mt-1 text-xs text-ink-900">{s.replacement}</p>
                  <p className="mt-1.5 text-[11px] text-ink-500">{s.reason}</p>
                  <div className="mt-2 flex gap-1">
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => apply(s)}>
                      Apply
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSuggestions((l) => l.filter((x) => x !== s))}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
          {!loading && suggestions.length === 0 && <p className="text-xs text-ink-500">No open suggestions.</p>}
        </div>
      </section>

      <section>
        <div className="eyebrow mb-3 flex items-center gap-2">
          <AlertTriangle className="size-3.5" /> Fact-check flags
        </div>
        <div className="space-y-2">
          {flags.map((f, i) => (
            <div key={i} className="rounded-card border border-ink-200 bg-surface p-3">
              <div className="flex items-center gap-2">
                <span className={cn("size-1.5 rounded-full", f.severity === "high" ? "bg-negative" : f.severity === "medium" ? "bg-warning" : "bg-ink-300")} />
                <span className="text-[11px] text-ink-500 capitalize">{f.issue.replace(/_/g, " ")}</span>
              </div>
              <p className="mt-1.5 text-xs text-ink-900">“{f.claim}”</p>
              <p className="mt-1 text-[11px] text-ink-500">{f.suggestion}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="eyebrow mb-3">Citations</div>
        <ol className="space-y-2">
          {citations.map((c) => (
            <li key={c.id} className="flex gap-2.5 rounded-card border border-ink-200 bg-surface p-3 text-xs">
              <span className="num flex size-4 shrink-0 items-center justify-center rounded-full bg-navy-100 text-[9px] text-navy-800">{c.id}</span>
              <span>
                <span className="block text-ink-900">{c.title}</span>
                <span className="text-ink-500">
                  {c.source} · <span className="num">{c.date}</span>
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
