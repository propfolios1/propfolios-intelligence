"use client";

import { Check, Copy, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { toast } from "@/components/ui/toaster";
import { RelativeTime } from "@/components/ui/relative-time";

export type ActionKindView = "rent_reminder" | "send_memo" | "schedule_follow_up" | "send_dd_to_lender" | "update_crm" | "esign_envelope" | "escalate";

export interface ActionView {
  id: string;
  kind: ActionKindView;
  status: "proposed" | "executed" | "reversed" | "failed" | "dismissed";
  title: string;
  rationale: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  proposedBy: string;
  executedBy: string | null;
  executedAt: string | null;
  reversedBy: string | null;
  error: string | null;
  createdAt: string;
}

export const ACTION_KIND_LABEL: Record<ActionKindView, string> = {
  rent_reminder: "Rent reminder",
  send_memo: "Send memo to client",
  schedule_follow_up: "Schedule follow-up",
  send_dd_to_lender: "Send due diligence to lender",
  update_crm: "Update client record",
  esign_envelope: "Signature envelope",
  escalate: "Escalate to senior analyst",
};

const TONE: Record<ActionView["status"], PillTone> = { proposed: "progress", executed: "complete", reversed: "neutral", failed: "error", dismissed: "neutral" };

function useAct(id: string) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const act = async (verb: "execute" | "reverse" | "dismiss") => {
    setBusy(true);
    const res = await fetch(`/api/actions/${id}/${verb}`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error(verb === "execute" ? "Action not executed" : verb === "reverse" ? "Action not reversed" : "Not dismissed", { description: json.error });
    toast.success(verb === "execute" ? "Action executed" : verb === "reverse" ? "Action reversed" : "Action dismissed", { description: verb === "reverse" ? "Every change it made has been undone." : undefined });
    router.refresh();
  };
  return { busy, act };
}

/** Approve, dismiss or reverse one agent action. Reversal undoes exactly what execution recorded. */
export function ActionButton({ action }: { action: ActionView }) {
  const { busy, act } = useAct(action.id);
  const [confirm, setConfirm] = React.useState(false);
  if (action.status === "proposed" || action.status === "failed") {
    return (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => void act("execute")} disabled={busy}>
          {action.status === "failed" ? "Retry" : "Approve and run"}
        </Button>
        {action.status === "proposed" && (
          <Button size="sm" variant="ghost" onClick={() => void act("dismiss")} disabled={busy}>
            Dismiss
          </Button>
        )}
      </div>
    );
  }
  if (action.status === "executed") {
    return (
      <>
        <Button size="sm" variant="secondary" onClick={() => setConfirm(true)} disabled={busy}>
          <RotateCcw /> Reverse
        </Button>
        <Dialog open={confirm} onOpenChange={setConfirm}>
          <DialogContent>
            <DialogTitle className="font-display text-card text-navy-900">Reverse “{action.title}”?</DialogTitle>
            <DialogDescription className="mt-2 text-ui text-ink-700">Everything this action changed is undone: messages withdrawn, links revoked, records restored. The reversal is recorded in the audit log.</DialogDescription>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  await act("reverse");
                  setConfirm(false);
                }}
              >
                Reverse action
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }
  return null;
}

function ResultLine({ action }: { action: ActionView }) {
  const r = action.result ?? {};
  const [copied, setCopied] = React.useState(false);
  if (action.kind === "send_dd_to_lender" && typeof r.url === "string" && action.status === "executed") {
    return (
      <div className="mt-2 flex items-center gap-2 rounded-sm bg-ink-100 px-3 py-2">
        <code className="num min-w-0 flex-1 truncate text-axis text-ink-700">{r.url}</code>
        <Button
          size="icon-sm"
          variant="ghost"
          aria-label="Copy link"
          onClick={() => {
            void navigator.clipboard.writeText(r.url as string);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
    );
  }
  if (action.kind === "escalate" && typeof r.newAnalystName === "string") return <p className="mt-1 text-small text-ink-500">Reassigned to {r.newAnalystName}.</p>;
  if (action.kind === "schedule_follow_up" && typeof r.dueAt === "string") return <p className="mt-1 text-small text-ink-500">Due {new Date(r.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.</p>;
  return null;
}

/** The action queue for a mandate or the firm: proposals first, then history. */
export function ActionsPanel({ actions }: { actions: ActionView[] }) {
  const order = { proposed: 0, failed: 1, executed: 2, reversed: 3, dismissed: 4 } as const;
  const sorted = [...actions].sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt));
  if (!sorted.length) return <p className="text-small text-ink-500">No actions yet. The action agent proposes follow-ups when a mandate reaches review and again on approval.</p>;
  return (
    <ul className="divide-y divide-ink-200 border-y border-ink-200">
      {sorted.map((a) => (
        <li key={a.id} className="flex flex-col gap-3 py-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-axis uppercase tracking-[0.12em] text-ink-500">{ACTION_KIND_LABEL[a.kind]}</span>
              <StatusPill tone={TONE[a.status]}>{a.status}</StatusPill>
            </div>
            <div className="mt-1 text-ui font-medium text-ink-900">{a.title}</div>
            <p className="mt-0.5 max-w-[72ch] text-small text-ink-700">{a.rationale}</p>
            <p className="mt-1 text-small text-ink-500">
              Proposed by {a.proposedBy} <RelativeTime iso={a.createdAt} />
              {a.executedBy && ` · run by ${a.executedBy}`}
              {a.reversedBy && a.status === "reversed" && ` · reversed by ${a.reversedBy}`}
            </p>
            {a.error && <p className="mt-1 text-small text-danger">{a.error}</p>}
            <ResultLine action={a} />
          </div>
          <div className="shrink-0">
            <ActionButton action={a} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A person proposes an action by hand (rent reminders, follow-ups, lender links). */
export function ProposeActionDialog({ mandateId, clientId }: { mandateId?: string; clientId?: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [kind, setKind] = React.useState<ActionKindView>("schedule_follow_up");
  const [title, setTitle] = React.useState("");
  const [rationale, setRationale] = React.useState("");
  const [days, setDays] = React.useState("7");
  const [recipient, setRecipient] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: Record<string, unknown> = {};
    if (kind === "schedule_follow_up" || kind === "send_dd_to_lender") payload.dueInDays = Number(days) || 7;
    if (kind === "send_dd_to_lender") payload.recipient = recipient || "Lender";
    if (kind === "rent_reminder" && amount) payload.amountAed = Number(amount.replace(/[^\d.]/g, ""));
    const res = await fetch("/api/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, mandateId: mandateId ?? null, clientId: clientId ?? null, title: title || ACTION_KIND_LABEL[kind], rationale: rationale || "Proposed by the analyst.", payload }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Action not proposed", { description: json.error });
    toast.success("Action proposed", { description: "Approve it to run." });
    setOpen(false);
    setTitle("");
    setRationale("");
    router.refresh();
  }
  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Propose action
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle className="font-display text-card text-navy-900">Propose an action</DialogTitle>
          <DialogDescription className="mt-2 text-ui text-ink-700">It is added to the queue and runs only when approved.</DialogDescription>
          <form onSubmit={submit} className="mt-6 grid gap-4">
            <FormField label="Action" htmlFor="kind">
              <Select id="kind" value={kind} onChange={(e) => setKind(e.target.value as ActionKindView)}>
                {(Object.keys(ACTION_KIND_LABEL) as ActionKindView[]).map((k) => (
                  <option key={k} value={k}>
                    {ACTION_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Title" htmlFor="title">
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={ACTION_KIND_LABEL[kind]} />
            </FormField>
            <FormField label="Reason" htmlFor="rationale">
              <Textarea id="rationale" rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} />
            </FormField>
            {(kind === "schedule_follow_up" || kind === "send_dd_to_lender") && (
              <FormField label={kind === "send_dd_to_lender" ? "Link valid for (days)" : "Due in (days)"} htmlFor="days">
                <Input id="days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
              </FormField>
            )}
            {kind === "send_dd_to_lender" && (
              <FormField label="Recipient" htmlFor="recipient">
                <Input id="recipient" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Credit team, Emirates NBD" />
              </FormField>
            )}
            {kind === "rent_reminder" && (
              <FormField label="Amount outstanding (AED)" htmlFor="amount">
                <Input id="amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="42,500" />
              </FormField>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Propose
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
