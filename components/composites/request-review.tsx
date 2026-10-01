"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

/** Client asks their advisory team to review a property; posts to the message thread. */
export function RequestReview({ propertyName }: { propertyName: string }) {
  const [sent, setSent] = React.useState(false);
  async function send() {
    setSent(true);
    const res = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ body: `Please prepare an analysis of ${propertyName} for my portfolio.` }) });
    if (!res.ok) {
      setSent(false);
      return void toast.error("Request not sent. Retry.");
    }
    toast.success("Request sent", { description: "Your advisory team will open a mandate and reply in Messages." });
  }
  return (
    <Button variant="secondary" size="sm" className="w-full" onClick={send} disabled={sent}>
      {sent ? "Requested" : "Request analysis"}
    </Button>
  );
}
