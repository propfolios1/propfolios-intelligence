"use client";

import { ArrowUp, Check, Copy, Square } from "lucide-react";
import * as React from "react";
import { CitedText, type CitationSource } from "./citation";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

const SUGGESTIONS = [
  "How has my portfolio performed this quarter?",
  "Which holdings need my attention?",
  "Should I take profit on any of my Dubai assets?",
  "Compare my UAE and India exposure.",
];

/** Minimal markdown: paragraphs, "- " bullets, **bold**, with [n] citation pills. */
function Rich({ text, sources }: { text: string; sources: CitationSource[] }) {
  const blocks = text.split(/\n\s*\n/);
  const inline = (s: string, k: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? (
        <strong key={`${k}-${i}`}>{part.slice(2, -2)}</strong>
      ) : (
        <CitedText key={`${k}-${i}`} text={part} sources={sources} />
      ),
    );
  return (
    <>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s/.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s/, ""), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(b, String(i))}</p>;
      })}
    </>
  );
}

export function Assistant({ initialQuery }: { initialQuery?: string }) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState(initialQuery ?? "");
  const [streaming, setStreaming] = React.useState(false);
  const [sources, setSources] = React.useState<CitationSource[]>([]);
  const abortRef = React.useRef<AbortController | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    const history: Message[] = [...messages.filter((m) => !m.error), { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const patchLast = (fn: (m: Message) => Message) => setMessages((ms) => [...ms.slice(0, -1), fn(ms.at(-1)!)]);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error("Assistant unavailable.");
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line);
          if (e.type === "sources") setSources(e.sources);
          if (e.type === "delta") patchLast((m) => ({ ...m, content: m.content + e.text }));
          if (e.type === "error") patchLast((m) => ({ ...m, content: m.content || e.message, error: !m.content }));
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") patchLast((m) => ({ ...m, content: m.content || "The assistant is unavailable right now.", error: !m.content }));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  const empty = messages.length === 0;

  return (
    <div className="flex h-[calc(100dvh-56px)] flex-col">
      <div className="scrollbar-thin flex-1 overflow-y-auto px-6">
        <div className="mx-auto max-w-[720px] py-12">
          {empty ? (
            <div className="pt-[12vh]">
              <div className="eyebrow">Client assistant</div>
              <h1 className="mt-3 font-display text-section font-medium text-navy-900">What would you like to know?</h1>
              <p className="mt-3 text-lead text-ink-600">Ask about your holdings, alerts, or the UAE and India markets. Answers cite their sources.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {messages.map((m, i) => {
                const isLast = i === messages.length - 1;
                return m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-card bg-navy-100 px-4 py-3 text-body whitespace-pre-wrap text-navy-900">{m.content}</div>
                  </div>
                ) : (
                  <AssistantMessage key={i} message={m} sources={sources} streaming={streaming && isLast} />
                );
              })}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-ink-200 bg-paper px-6 pt-4 pb-6">
        <div className="mx-auto max-w-[720px]">
          {empty && (
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-card border border-ink-200 bg-surface px-4 py-3 text-left text-sm text-ink-700 transition-[border-color,transform] duration-150 ease-brand hover:-translate-y-px hover:border-ink-300"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 rounded-card border border-ink-200 bg-surface p-2 transition-[border-color] duration-150 focus-within:border-navy-500"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask about your portfolio…"
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-body text-ink-900 outline-none placeholder:text-ink-400"
              aria-label="Message"
            />
            {streaming ? (
              <Button type="button" size="icon" variant="secondary" onClick={() => abortRef.current?.abort()} aria-label="Stop">
                <Square className="size-3.5 fill-current" />
              </Button>
            ) : (
              <Button type="submit" size="icon" disabled={!input.trim()} aria-label="Send">
                <ArrowUp />
              </Button>
            )}
          </form>
          <p className="mt-2 text-center text-[11px] text-ink-400">Not investment, tax or legal advice. Your analyst reviews material decisions.</p>
        </div>
      </div>
    </div>
  );
}

function AssistantMessage({ message, sources, streaming }: { message: Message; sources: CitationSource[]; streaming: boolean }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <div className="group relative">
      <div className={cn("prose-pf prose-lg-pf [&_p]:mb-[1.25em] [&_p:last-child]:mb-0", message.error && "text-negative")}>
        {message.content ? <Rich text={message.content} sources={sources} /> : <p />}
        {streaming && <span className="ml-0.5 inline-block h-[1.1em] w-0.5 translate-y-[3px] animate-caret bg-navy-900" aria-hidden />}
      </div>
      {!streaming && message.content && (
        <button
          onClick={() => {
            navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="mt-3 flex items-center gap-1.5 rounded-control px-2 py-1 text-xs text-ink-500 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-ink-100 hover:text-ink-900 focus-visible:opacity-100"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}
