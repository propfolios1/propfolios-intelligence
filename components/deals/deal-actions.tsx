"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { FormField, Input, Select, Textarea } from "@/components/ui/form";
import { MoneyInput } from "@/components/ui/money-input";
import { toast } from "@/components/ui/toaster";
import { useDealAction } from "./use-deal-action";

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function OfferForm({ dealId, currency, side, parentOfferId, defaultParty, label = "Record offer" }: { dealId: string; currency: string; side: "buy" | "sell"; parentOfferId?: string; defaultParty?: "buyer" | "seller"; label?: string }) {
  const { run, busy } = useDealAction(dealId);
  const [open, setOpen] = React.useState(false);
  const [party, setParty] = React.useState<"buyer" | "seller">(defaultParty ?? (side === "buy" ? "buyer" : "seller"));
  const [amount, setAmount] = React.useState<number | null>(null);
  const [deposit, setDeposit] = React.useState(10);
  const [days, setDays] = React.useState(45);
  const [conditions, setConditions] = React.useState("");
  const submit = async (submitNow: boolean) => {
    if (!amount) return;
    const r = await run("offer", { type: parentOfferId ? "counter" : "offer", party, amount, submit: submitNow, parentOfferId: parentOfferId ?? null, terms: { depositPct: deposit, completionDays: days, conditions: lines(conditions) } }, submitNow ? "Offer submitted" : "Offer saved as draft");
    if (r) setOpen(false);
  };
  return (
    <>
      <Button variant={parentOfferId ? "secondary" : "primary"} size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{parentOfferId ? "Counter-offer" : "Offer"}</DialogTitle>
          <DialogDescription>Submitting raises deal.offer_sent: the negotiation coach and the forecast run on the new position.</DialogDescription>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="From">
              <Select value={party} onChange={(e) => setParty(e.target.value as "buyer" | "seller")}>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
              </Select>
            </FormField>
            <FormField label="Amount">
              <MoneyInput value={amount} onChange={setAmount} currency={currency} />
            </FormField>
            <FormField label="Deposit (%)">
              <Input type="number" min={0} max={100} value={deposit} onChange={(e) => setDeposit(Number(e.target.value))} className="num" />
            </FormField>
            <FormField label="Completion (days)">
              <Input type="number" min={1} max={730} value={days} onChange={(e) => setDays(Number(e.target.value))} className="num" />
            </FormField>
            <FormField label="Conditions, one per line" className="sm:col-span-2">
              <Textarea rows={3} value={conditions} onChange={(e) => setConditions(e.target.value)} />
            </FormField>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => void submit(false)} disabled={!!busy || !amount}>
              Save draft
            </Button>
            <Button onClick={() => void submit(true)} disabled={!!busy || !amount}>
              {busy ? "Submitting" : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function OfferResponse({ dealId, offerId }: { dealId: string; offerId: string }) {
  const { run, busy } = useDealAction(dealId);
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => void run("offer-respond", { offerId, decision: "accepted" }, "Offer accepted; the deal moves to contract")} disabled={!!busy}>
        Accept
      </Button>
      <Button size="sm" variant="secondary" onClick={() => void run("offer-respond", { offerId, decision: "rejected" }, "Offer rejected")} disabled={!!busy}>
        Reject
      </Button>
    </div>
  );
}

export function SubmitDraft({ dealId, offerId }: { dealId: string; offerId: string }) {
  const { run, busy } = useDealAction(dealId);
  return (
    <Button size="sm" variant="secondary" onClick={() => void run("offer-submit", { offerId }, "Offer submitted")} disabled={!!busy}>
      Submit
    </Button>
  );
}

export function RoundForm({ dealId, currency }: { dealId: string; currency: string }) {
  const { run, busy } = useDealAction(dealId);
  const [party, setParty] = React.useState<"buyer" | "seller" | "advisor">("seller");
  const [price, setPrice] = React.useState<number | null>(null);
  const [asks, setAsks] = React.useState("");
  const [concessions, setConcessions] = React.useState("");
  const [notes, setNotes] = React.useState("");
  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-md border border-hairline bg-surface p-5 shadow-card md:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await run("round", { party, price: price ?? undefined, asks: lines(asks), concessions: lines(concessions), notes: notes || undefined }, "Round recorded");
        if (r) {
          setAsks("");
          setConcessions("");
          setNotes("");
          setPrice(null);
        }
      }}
    >
      <FormField label="Party">
        <Select value={party} onChange={(e) => setParty(e.target.value as "buyer" | "seller" | "advisor")}>
          <option value="seller">Seller</option>
          <option value="buyer">Buyer</option>
          <option value="advisor">Adviser</option>
        </Select>
      </FormField>
      <FormField label="Price position">
        <MoneyInput value={price} onChange={setPrice} currency={currency} />
      </FormField>
      <FormField label="Asks, one per line">
        <Textarea rows={3} value={asks} onChange={(e) => setAsks(e.target.value)} />
      </FormField>
      <FormField label="Concessions, one per line">
        <Textarea rows={3} value={concessions} onChange={(e) => setConcessions(e.target.value)} />
      </FormField>
      <FormField label="Notes" className="md:col-span-2">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </FormField>
      <div className="flex justify-end md:col-span-2">
        <Button type="submit" disabled={!!busy}>
          {busy ? "Recording" : "Record round"}
        </Button>
      </div>
    </form>
  );
}

export function GenerateContract({ dealId, types }: { dealId: string; types: { type: string; title: string }[] }) {
  const { run, busy } = useDealAction(dealId);
  const [type, setType] = React.useState(types[0]?.type ?? "");
  return (
    <div className="flex flex-wrap items-end gap-3">
      <FormField label="Document">
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          {types.map((t) => (
            <option key={t.type} value={t.type}>
              {t.title}
            </option>
          ))}
        </Select>
      </FormField>
      <Button onClick={() => void run("contract", { type }, "Contract drafted; the contract reviewer is reading it")} disabled={!!busy}>
        {busy ? "Drafting" : "Draft from agreed terms"}
      </Button>
    </div>
  );
}

export function SendForSignature({ dealId, contractId, defaults }: { dealId: string; contractId: string; defaults: { party: "buyer" | "seller" | "advisor" | "witness"; name: string; email: string }[] }) {
  const { run, busy } = useDealAction(dealId);
  const [open, setOpen] = React.useState(false);
  const [signers, setSigners] = React.useState(defaults);
  const [links, setLinks] = React.useState<{ email: string; url: string }[]>([]);
  const set = (i: number, k: "name" | "email", v: string) => setSigners((xs) => xs.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Send for signature
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>Send for signature</DialogTitle>
          <DialogDescription>Through Dropbox Sign when connected; otherwise each signer receives a single-use link, confirms their email and signs. Time and network address are recorded.</DialogDescription>
          <div className="mt-4 space-y-3">
            {signers.map((x, i) => (
              <div key={i} className="grid grid-cols-[90px_1fr_1fr] items-end gap-2">
                <span className="pb-2 text-small text-ink-700 capitalize">{x.party}</span>
                <Input value={x.name} onChange={(e) => set(i, "name", e.target.value)} aria-label={`${x.party} name`} />
                <Input type="email" value={x.email} onChange={(e) => set(i, "email", e.target.value)} aria-label={`${x.party} email`} />
              </div>
            ))}
          </div>
          {links.length > 0 && (
            <div className="mt-4 space-y-2 rounded-sm bg-navy-50 p-3 text-small">
              <div className="font-medium text-ink-900">Signing links (also emailed)</div>
              {links.map((l) => (
                <div key={l.email} className="break-all">
                  <span className="text-ink-700">{l.email}: </span>
                  <a className="text-navy-900 underline" href={l.url} target="_blank" rel="noreferrer">
                    {l.url}
                  </a>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
            {!links.length && (
              <Button
                disabled={!!busy || signers.some((x) => !x.email || !x.name)}
                onClick={async () => {
                  const r = await run("send", { contractId, signers }, "Sent for signature");
                  if (r?.links?.length) setLinks(r.links);
                  else if (r) setOpen(false);
                }}
              >
                {busy ? "Sending" : "Send"}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PaymentButton({ dealId, paymentId, status }: { dealId: string; paymentId: string; status: string }) {
  const { run, busy } = useDealAction(dealId);
  if (status === "paid" || status === "waived") return null;
  return (
    <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => void run("payment", { paymentId, status: "paid", reference: `REF-${Date.now().toString(36).toUpperCase()}` }, "Payment recorded")}>
      Mark paid
    </Button>
  );
}

export function ChecklistToggle({ dealId, itemId, status }: { dealId: string; itemId: string; status: string }) {
  const { run, busy } = useDealAction(dealId);
  const done = status === "done" || status === "waived";
  return (
    <input
      type="checkbox"
      checked={done}
      disabled={!!busy}
      aria-label="Done"
      onChange={() => void run("checklist", { itemId, status: done ? "open" : "done" })}
      className="size-4 cursor-pointer accent-[var(--navy-900)]"
    />
  );
}

export function CloseDeal({ dealId, disabledReason }: { dealId: string; disabledReason?: string }) {
  const { run, busy } = useDealAction(dealId);
  const [lose, setLose] = React.useState(false);
  const [reason, setReason] = React.useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        disabled={!!busy || !!disabledReason}
        title={disabledReason}
        onClick={() => void run("close", {}, "Deal closed: commission, invoice and client notifications follow")}
      >
        {busy === "close" ? "Closing" : "Close as won"}
      </Button>
      <Button variant="ghost" onClick={() => setLose(true)}>
        Mark lost
      </Button>
      <Dialog open={lose} onOpenChange={setLose}>
        <DialogContent>
          <DialogTitle>Mark deal lost</DialogTitle>
          <DialogDescription>The reason is kept for the deal predictor&apos;s record of why deals fail.</DialogDescription>
          <Textarea className="mt-4" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Seller accepted a higher offer from another buyer." />
          <div className="mt-4 flex justify-end">
            <Button
              variant="destructive"
              disabled={reason.trim().length < 3}
              onClick={async () => {
                const r = await run("lose", { reason }, "Deal marked lost");
                if (r) setLose(false);
                else toast.error("Deal not updated", { description: "The change was not saved. Retry; if it persists, reload the deal to see its current stage." });
              }}
            >
              Mark lost
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
