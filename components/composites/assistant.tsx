"use client";

import * as React from "react";
import { CopyButton } from "@/components/primitives/copy-button";
import { cn } from "@/lib/utils";
import { CitedText, type CitationSource } from "./citation";

interface Message {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

const PROMPTS = [
  "How did the portfolio perform this quarter?",
  "Which holdings need attention?",
  "Is there a case for taking profit in Dubai?",
  "Compare UAE and India exposure.",
];

/** Paragraphs, ruled lists, **bold**, and [n] citations. */
function Rich({ text, sources }: { text: string; sources: CitationSource[] }) {
  const inline = (s: string, k: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
      part.startsWith("**") && part.endsWith("**") ? <strong key={`${k}-${i}`}>{part.slice(2, -2)}</strong> : <CitedText key={`${k}-${i}`} text={part} sources={sources} />,
    );
  return (
    <>
      {text.split(/\n\s*\n/).map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-*•]\s/.test(l)))
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*•]\s/, ""), `${i}-${j}`)}</li>
              ))}
            </ul>
          );
        return <p key={i}>{inline(b, String(i))}</p>;
      })}
    </>
  );
}

/**
 * The client's reading room. Replies are set as prose at 18px on a 720px
 * measure; questions sit right-aligned in ink-2. A 1.5px gold caret marks
 * where the answer is being written.
 */
export function Assistant({ initialQuery }: { initialQuery?: string }) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState(initialQuery ?? "");
  const [streaming, setStreaming] = React.useState(false);
  const [sources, setSources] = React.useState<CitationSource[]>([]);
  const abortRef = React.useRef<AbortController | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => endRef.current?.scrollIntoView({ block: "end" }), [messages]);

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
      if (!res.ok || !res.body) throw new Error();
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
      if ((err as Error).name !== "AbortError") patchLast((m) => ({ ...m, content: m.content || "Could not reach the assistant. Retry.", error: !m.content }));
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
        <div className="mx-auto max-w-[720px] pt-16 pb-12">
          {empty ? (
            <div className="pt-[8vh]">
              <div className="eyebrow">Ask</div>
              <h1 className="mt-5 font-display text-title text-navy">Questions about your portfolio, answered with sources.</h1>
              <ol className="mt-12 border-b border-rule">
                {PROMPTS.map((p, i) => (
                  <li key={p}>
                    <button
                      onClick={() => send(p)}
                      className="group grid w-full grid-cols-[40px_1fr_auto] items-baseline border-t border-rule py-4 text-left transition-[background-color] duration-120 hover:bg-paper-2"
                    >
                      <span className="num pl-1 text-small text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-body text-ink">{p}</span>
                      <span className="pr-2 text-ink-3 transition-[color,transform] duration-120 group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden>
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="flex flex-col gap-12">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <p key={i} className="ml-auto max-w-[80%] border-r border-ink pr-4 text-right text-body whitespace-pre-wrap text-ink-2">
                    {m.content}
                  </p>
                ) : (
                  <Reply key={i} message={m} sources={sources} streaming={streaming && i === messages.length - 1} />
                ),
              )}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t border-rule px-6 pt-5 pb-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-[720px] items-end gap-3"
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
            placeholder="Ask about a holding, an alert or a market"
            aria-label="Question"
            className="max-h-40 min-h-12 flex-1 resize-none rounded-sm border border-rule bg-paper px-4 py-3 text-body text-ink placeholder:text-ink-3 transition-[border-color] duration-120 focus:border-ink focus:outline-2 focus:outline-offset-2 focus:outline-gold"
          />
          {streaming ? (
            <button type="button" onClick={() => abortRef.current?.abort()} className="h-12 rounded-sm border border-rule px-5 text-small text-ink transition-[border-color] duration-120 hover:border-ink">
              Stop
            </button>
          ) : (
            <button type="submit" disabled={!input.trim()} className="h-12 rounded-sm bg-navy px-5 text-small font-medium text-paper transition-[background-color] duration-120 ease-linear hover:bg-ink disabled:opacity-40">
              Ask
            </button>
          )}
        </form>
        <p className="mx-auto mt-3 max-w-[720px] text-small text-ink-3">Answers are informational. Your analyst signs off material decisions.</p>
      </div>
    </div>
  );
}

function Reply({ message, sources, streaming }: { message: Message; sources: CitationSource[]; streaming: boolean }) {
  return (
    <article className="group">
      <div className={cn("prose-pf prose-read", message.error && "text-red")}>
        {message.content ? <Rich text={message.content} sources={sources} /> : <p />}
        {streaming && <span className="ml-0.5 inline-block h-[1.15em] w-[1.5px] translate-y-[3px] animate-caret bg-gold" aria-hidden />}
      </div>
      {!streaming && message.content && !message.error && (
        <div className="mt-2 opacity-0 transition-opacity duration-120 group-hover:opacity-100 focus-within:opacity-100">
          <CopyButton value={message.content} />
        </div>
      )}
    </article>
  );
}
