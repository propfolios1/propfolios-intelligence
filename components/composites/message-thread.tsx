"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";
import { cn, formatDate } from "@/lib/utils";

interface Msg {
  id: string;
  authorName: string;
  authorRole: "platform_admin" | "tenant_admin" | "analyst" | "client";
  body: string;
  createdAt: string;
}

/** Client and advisory team conversation. Polls every 15s; sends optimistically. */
export function MessageThread({ clientId, initial, viewerIsClient, viewerName }: { clientId: string; initial: Msg[]; viewerIsClient: boolean; viewerName: string }) {
  const qc = useQueryClient();
  const key = ["messages", clientId];
  const { data = initial } = useQuery<Msg[]>({
    queryKey: key,
    queryFn: async () => (await (await fetch(`/api/messages?clientId=${clientId}`)).json()) as Msg[],
    initialData: initial,
    refetchInterval: 15_000,
  });
  const [body, setBody] = React.useState("");
  const end = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => end.current?.scrollIntoView({ block: "end" }), [data.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    const optimistic: Msg = { id: `tmp-${Date.now()}`, authorName: viewerName, authorRole: viewerIsClient ? "client" : "analyst", body: text, createdAt: new Date().toISOString() };
    qc.setQueryData<Msg[]>(key, (m = []) => [...m, optimistic]);
    setBody("");
    const res = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId, body: text }) });
    if (!res.ok) {
      qc.setQueryData<Msg[]>(key, (m = []) => m.filter((x) => x.id !== optimistic.id));
      setBody(text);
      return void toast.error("Message not sent. Retry.");
    }
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="flex flex-col rounded-md border border-hairline bg-surface shadow-card">
      <ol className="scrollbar-thin flex max-h-[560px] min-h-[320px] flex-col gap-4 overflow-y-auto p-5" aria-live="polite">
        {data.length === 0 && <li className="text-small text-ink-500">No messages yet.</li>}
        {data.map((m) => {
          const mine = viewerIsClient ? m.authorRole === "client" : m.authorRole !== "client";
          return (
            <li key={m.id} className={cn("max-w-[80%]", mine ? "self-end text-right" : "self-start")}>
              <div className={cn("rounded-md px-4 py-2.5 text-ui", mine ? "bg-navy-900 text-surface" : "bg-ink-100 text-ink-900")}>{m.body}</div>
              <div className="mt-1 text-axis text-ink-500">
                {m.authorName} · <span className="num">{formatDate(m.createdAt, "datetime")}</span>
              </div>
            </li>
          );
        })}
        <div ref={end} />
      </ol>
      <form onSubmit={send} className="flex items-end gap-3 border-t border-hairline p-4">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              (e.currentTarget.form as HTMLFormElement).requestSubmit();
            }
          }}
          rows={2}
          placeholder={viewerIsClient ? "Write to your advisory team" : "Write to the client"}
          aria-label="Message"
          className="flex-1"
        />
        <Button type="submit" disabled={!body.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}
