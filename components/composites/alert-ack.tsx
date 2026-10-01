"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "@/components/ui/toaster";

/** Optimistic acknowledge toggle for an alert. */
export function AlertAck({ id, acknowledged }: { id: string; acknowledged: boolean }) {
  const router = useRouter();
  const [ack, setAck] = React.useState(acknowledged);
  async function toggle() {
    const next = !ack;
    setAck(next);
    const res = await fetch("/api/alerts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, acknowledged: next }) });
    if (!res.ok) {
      setAck(!next);
      return void toast.error("Alert not updated");
    }
    router.refresh();
  }
  return (
    <button onClick={toggle} className="mt-1.5 text-small text-ink-500 underline decoration-ink-200 underline-offset-4 hover:text-ink-900">
      {ack ? "Acknowledged. Re-open" : "Acknowledge"}
    </button>
  );
}
