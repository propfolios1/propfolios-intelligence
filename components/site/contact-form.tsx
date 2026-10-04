"use client";

import * as React from "react";

/** Public enquiry form. Each submission becomes a lead in the firm's workspace, sourced to the website. */
export function SiteContactForm({ slug, listingId, listingTitle }: { slug: string; listingId?: string; listingTitle?: string }) {
  const [f, setF] = React.useState({ name: "", email: "", phone: "", message: listingTitle ? `I would like to know more about ${listingTitle}.` : "", consent: true });
  const [state, setState] = React.useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = React.useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });
  const field = "h-12 w-full border bg-transparent px-4 text-[15px] outline-none transition-colors duration-150 focus:border-[color:var(--site-primary)]";
  const style = { borderColor: "var(--site-line)", borderRadius: "var(--site-radius)", color: "var(--site-ink)" } as const;
  if (state === "sent")
    return (
      <div className="border p-8" style={{ ...style, background: "var(--site-surface)" }} role="status">
        <p className="text-[20px]" style={{ fontFamily: "var(--site-display)" }}>
          Thank you. Your message is with our team.
        </p>
        <p className="mt-2 text-[15px]" style={{ color: "var(--site-muted)" }}>
          An agent will reply within the working day.
        </p>
      </div>
    );
  return (
    <form
      className="grid gap-4 border p-6 md:p-8"
      style={{ ...style, background: "var(--site-surface)" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setState("sending");
        const r = await fetch(`/api/sites/${slug}/contact`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...f, listingId }) });
        if (r.ok) setState("sent");
        else {
          setState("error");
          setError((await r.json().catch(() => ({}))).error ?? "The message was not sent. Try again in a minute.");
        }
      }}
    >
      <label className="grid gap-1.5 text-[13px]">
        Name
        <input className={field} style={style} value={f.name} onChange={set("name")} required minLength={2} autoComplete="name" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1.5 text-[13px]">
          Email
          <input className={field} style={style} type="email" value={f.email} onChange={set("email")} autoComplete="email" />
        </label>
        <label className="grid gap-1.5 text-[13px]">
          Phone
          <input className={field} style={style} value={f.phone} onChange={set("phone")} autoComplete="tel" />
        </label>
      </div>
      <label className="grid gap-1.5 text-[13px]">
        Message
        <textarea className={`${field} h-28 py-3`} style={style} value={f.message} onChange={set("message")} maxLength={2000} />
      </label>
      <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--site-muted)" }}>
        <input type="checkbox" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} /> Send me new listings that match. Unsubscribe at any time.
      </label>
      {state === "error" && (
        <p role="alert" className="text-[14px] text-[#DC2626]">
          {error}
        </p>
      )}
      <button type="submit" disabled={state === "sending" || (!f.email && !f.phone)} className="h-12 px-6 text-[15px] font-medium transition-opacity duration-150 disabled:opacity-50" style={{ background: "var(--site-primary)", color: "var(--site-hero-ink)", borderRadius: "var(--site-radius)" }}>
        {state === "sending" ? "Sending" : "Send message"}
      </button>
    </form>
  );
}
