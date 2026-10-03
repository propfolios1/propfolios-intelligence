"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";

export function ForgetMemory({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Clear this memory? The agent will relearn from the firm's records on its next runs.")) return;
        setBusy(true);
        const r = await post(`/api/ai-memory/${id}`, {}, { method: "DELETE", ok: "Memory cleared", fail: "Memory not cleared" });
        setBusy(false);
        if (r) router.refresh();
      }}
    >
      {busy ? "Clearing" : "Forget"}
    </Button>
  );
}
