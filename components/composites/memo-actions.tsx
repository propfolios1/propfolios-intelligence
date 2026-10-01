"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function MemoActions({ memoId, status, reference }: { memoId: string; status: string; reference: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function approve(deliver: boolean) {
    setBusy(true);
    const res = await fetch(`/api/memos/${memoId}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deliver }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Not approved", { description: json.error });
    toast.success(deliver ? `${reference} delivered to the client` : "Memo approved");
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "delivered" && status !== "approved" && (
        <Button variant="secondary" onClick={() => approve(false)} disabled={busy}>
          Approve
        </Button>
      )}
      {status !== "delivered" && (
        <Button onClick={() => approve(true)} disabled={busy}>
          Approve and deliver
        </Button>
      )}
      <Button variant="secondary" asChild>
        <a href={`/api/memos/${memoId}/export`} target="_blank" rel="noreferrer">
          Export PDF
        </a>
      </Button>
    </div>
  );
}
