"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { AgentOutput } from "@/components/os/agent-output";
import { Button } from "@/components/ui/button";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";

type Cond = { field: string; op: string; value: string | number };
type Act = { type: string; to?: string; subject?: string; message?: string; dueInDays?: number };
type Draft = { name: string; trigger: string; conditions: Cond[]; actions: Act[] };

const TRIGGERS = [
  ["deal.closed", "A deal closes"],
  ["deal.stage_changed", "A deal changes stage"],
  ["mandate.created", "A mandate is created"],
  ["invoice.paid", "An invoice is paid"],
  ["commission.computed", "A commission is computed"],
  ["kyc.expired", "KYC expires"],
] as const;
const FIELDS = [
  ["jurisdiction", "Jurisdiction"],
  ["deal_value_aed", "Deal value (AED)"],
  ["client_residency", "Client residency"],
  ["stage", "Stage"],
  ["deal_type", "Deal type"],
] as const;
const ACTIONS = [
  ["notify_team", "Notify the team"],
  ["send_email", "Send email"],
  ["create_task", "Create a follow-up task"],
  ["generate_report", "Generate a client report"],
  ["notify_slack", "Post to Slack"],
] as const;

/** Describe an automation in a sentence (the builder agent drafts it) or compose it by hand; review, then save. */
export function AutomationBuilder() {
  const router = useRouter();
  const [request, setRequest] = React.useState("");
  const [draft, setDraft] = React.useState<Draft>({ name: "", trigger: "deal.closed", conditions: [], actions: [{ type: "notify_team" }] });
  const [agent, setAgent] = React.useState<{ output: { headline: string; points: { label: string; detail: string }[]; confidence: number }; model: string; costUsd: number } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const build = async () => {
    setBusy(true);
    const r = await post("/api/automations/build", { request }, { fail: "Could not draft the automation" });
    setBusy(false);
    if (r) {
      setDraft(r.output.automation);
      setAgent(r);
    }
  };
  const save = async () => {
    const r = await post("/api/automations", draft, { ok: "Automation saved and enabled", fail: "Automation not saved" });
    if (r) {
      setDraft({ name: "", trigger: "deal.closed", conditions: [], actions: [{ type: "notify_team" }] });
      setAgent(null);
      setRequest("");
      router.refresh();
    }
  };
  const setCond = (i: number, k: keyof Cond, v: string) => setDraft((d) => ({ ...d, conditions: d.conditions.map((c, j) => (j === i ? { ...c, [k]: k === "value" && d.conditions[i]!.field === "deal_value_aed" ? Number(v) : v } : c)) }));
  const setAct = (i: number, k: keyof Act, v: string) => setDraft((d) => ({ ...d, actions: d.actions.map((a, j) => (j === i ? { ...a, [k]: k === "dueInDays" ? Number(v) : v } : a)) }));
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-4 rounded-md border border-ink-200 bg-surface p-5 shadow-card">
        <div className="eyebrow">Agent 41 · Automation builder</div>
        <FormField label="Describe the automation">
          <Textarea rows={4} value={request} onChange={(e) => setRequest(e.target.value)} placeholder="When a Mumbai deal above AED 5M closes, email the compliance officer and create a follow-up task in three days." />
        </FormField>
        <Button onClick={build} disabled={busy || request.trim().length < 10}>
          {busy ? "Drafting" : "Draft it"}
        </Button>
        {agent && <AgentOutput agent="Automation builder" output={agent.output} model={agent.model} costUsd={agent.costUsd} />}
      </div>
      <div className="space-y-4 rounded-md border border-ink-200 bg-surface p-5 shadow-card">
        <div className="eyebrow">Review</div>
        <FormField label="Name">
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        </FormField>
        <FormField label="When">
          <Select value={draft.trigger} onChange={(e) => setDraft({ ...draft, trigger: e.target.value })}>
            {TRIGGERS.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="space-y-2">
          <div className="text-ui font-medium text-ink-900">Only if</div>
          {draft.conditions.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_110px_1fr_auto] gap-2">
              <Select value={c.field} onChange={(e) => setCond(i, "field", e.target.value)}>
                {FIELDS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
              <Select value={c.op} onChange={(e) => setCond(i, "op", e.target.value)}>
                <option value="eq">is</option>
                <option value="gt">above</option>
                <option value="lt">below</option>
                <option value="contains">contains</option>
              </Select>
              <Input value={String(c.value)} onChange={(e) => setCond(i, "value", e.target.value)} />
              <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, conditions: draft.conditions.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setDraft({ ...draft, conditions: [...draft.conditions, { field: "jurisdiction", op: "eq", value: "dubai" }] })}>
            Add condition
          </Button>
        </div>
        <div className="space-y-2">
          <div className="text-ui font-medium text-ink-900">Then</div>
          {draft.actions.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <Select value={a.type} onChange={(e) => setAct(i, "type", e.target.value)}>
                {ACTIONS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </Select>
              {a.type === "send_email" ? (
                <Input placeholder="Recipient email, or client" value={a.to ?? ""} onChange={(e) => setAct(i, "to", e.target.value)} />
              ) : a.type === "create_task" ? (
                <Input type="number" placeholder="Due in days" value={a.dueInDays ?? 3} onChange={(e) => setAct(i, "dueInDays", e.target.value)} />
              ) : (
                <Input placeholder="Message (optional)" value={a.message ?? ""} onChange={(e) => setAct(i, "message", e.target.value)} />
              )}
              <Button variant="ghost" size="sm" onClick={() => setDraft({ ...draft, actions: draft.actions.filter((_, j) => j !== i) })}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="secondary" size="sm" onClick={() => setDraft({ ...draft, actions: [...draft.actions, { type: "create_task", dueInDays: 3 }] })}>
            Add action
          </Button>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} disabled={draft.name.trim().length < 3 || !draft.actions.length}>
            Save and enable
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AutomationToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" onClick={async () => void ((await post(`/api/automations/${id}`, { enabled: !enabled }, { method: "PATCH", ok: enabled ? "Paused" : "Enabled" })) && router.refresh())}>
        {enabled ? "Pause" : "Enable"}
      </Button>
      <Button size="sm" variant="ghost" onClick={async () => void ((await post(`/api/automations/${id}`, {}, { method: "DELETE", ok: "Deleted" })) && router.refresh())}>
        Delete
      </Button>
    </div>
  );
}
