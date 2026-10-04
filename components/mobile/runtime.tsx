"use client";

import { Download, WifiOff } from "lucide-react";
import * as React from "react";

type BeforeInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registers the service worker, keeps the offline cache warm, replays queued actions on reconnection and offers installation. */
export function MobileRuntime() {
  const [online, setOnline] = React.useState(true);
  const [install, setInstall] = React.useState<BeforeInstall | null>(null);
  React.useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => {
      setOnline(true);
      navigator.serviceWorker?.controller?.postMessage("flush");
    };
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(async (reg) => {
          await navigator.serviceWorker.ready;
          reg.active?.postMessage("warm");
          // The offline data set: last 100 leads, listings and deals.
          fetch("/api/m/snapshot", { headers: { "x-nakhla-device": navigator.userAgent.slice(0, 120) } }).catch(() => undefined);
        })
        .catch(() => undefined);
    }
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      window.removeEventListener("beforeinstallprompt", onPrompt);
    };
  }, []);
  return (
    <>
      {!online && (
        <div className="flex items-center gap-2 bg-ink-900 px-4 py-2 text-[12px] text-surface" role="status">
          <WifiOff className="size-3.5" aria-hidden /> Offline. Showing saved data; actions are queued and sent when the connection returns.
        </div>
      )}
      {install && (
        <button
          type="button"
          onClick={async () => {
            await install.prompt();
            setInstall(null);
          }}
          className="flex w-full items-center justify-center gap-2 border-b border-hairline bg-navy-50 px-4 py-2 text-[13px] text-navy-900"
        >
          <Download className="size-3.5" aria-hidden /> Install Nakhla on this phone
        </button>
      )}
    </>
  );
}

/** Logs a call, WhatsApp or note against a lead; offline, the service worker queues it. */
export function QuickLog({ leadId, name }: { leadId: string; name: string }) {
  const [open, setOpen] = React.useState(false);
  const [summary, setSummary] = React.useState("");
  const [kind, setKind] = React.useState<"call" | "whatsapp" | "note">("call");
  const [state, setState] = React.useState<"idle" | "saving" | "saved" | "queued" | "error">("idle");
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="h-8 rounded-sm border border-hairline px-3 text-[12px] text-ink-700">
        {state === "saved" ? "Logged" : state === "queued" ? "Queued" : "Log"}
      </button>
    );
  return (
    <form
      className="mt-3 grid w-full gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("saving");
        try {
          const r = await fetch("/api/m/actions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "lead_activity", leadId, activity: kind, summary, clientAt: new Date().toISOString() }) });
          setState(r.status === 202 ? "queued" : r.ok ? "saved" : "error");
          if (r.ok) {
            setOpen(false);
            setSummary("");
          }
        } catch {
          setState("error");
        }
      }}
    >
      <div className="flex gap-1" role="group" aria-label="Activity">
        {(["call", "whatsapp", "note"] as const).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`h-8 flex-1 rounded-sm border text-[12px] ${kind === k ? "border-navy-900 bg-navy-900 text-surface" : "border-hairline text-ink-700"}`}>
            {k === "whatsapp" ? "WhatsApp" : k[0]!.toUpperCase() + k.slice(1)}
          </button>
        ))}
      </div>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} required minLength={2} placeholder={`What happened with ${name.split(" ")[0]}`} className="rounded-sm border border-hairline bg-surface p-2 text-[14px]" />
      <div className="flex gap-2">
        <button type="submit" disabled={state === "saving"} className="h-9 flex-1 rounded-sm bg-navy-900 text-[13px] text-surface">
          {state === "saving" ? "Saving" : "Save"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-sm px-3 text-[13px] text-ink-700">
          Cancel
        </button>
      </div>
      {state === "error" && <p className="text-[12px] text-danger">Not saved. Check the lead is still assigned to you.</p>}
    </form>
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Turns on push notifications for this device. */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = React.useState<"unknown" | "on" | "off" | "denied" | "unsupported" | "working">("unknown");
  React.useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.ready.then((r) => r.pushManager.getSubscription()).then((s) => setState(s ? "on" : "off"));
  }, []);
  if (!publicKey) return <p className="text-[13px] text-ink-500">Push is not configured on this deployment: the administrator sets the VAPID keys in the environment.</p>;
  if (state === "unsupported") return <p className="text-[13px] text-ink-500">This browser does not support web push. On iPhone, add Nakhla to the home screen first.</p>;
  if (state === "denied") return <p className="text-[13px] text-ink-500">Notifications are blocked for this site in the browser settings.</p>;
  return (
    <button
      type="button"
      disabled={state === "working" || state === "unknown"}
      onClick={async () => {
        setState("working");
        const reg = await navigator.serviceWorker.ready;
        if (state === "on") {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            await fetch("/api/m/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
            await sub.unsubscribe();
          }
          return setState("off");
        }
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
        await fetch("/api/m/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
        setState("on");
      }}
      className="h-10 w-full rounded-sm bg-navy-900 text-[14px] text-surface disabled:opacity-60"
    >
      {state === "on" ? "Turn off notifications on this device" : state === "working" ? "Working" : "Turn on notifications"}
    </button>
  );
}
