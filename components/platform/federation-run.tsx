"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

/** Runs the nightly aggregation on demand. */
export function FederationRunButton() {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch("/api/platform/federation/aggregate", { method: "POST" });
        const json = await res.json().catch(() => ({}));
        setBusy(false);
        if (!res.ok) return void toast.error("Aggregation failed", { description: json.error });
        toast.success("Federation aggregated", { description: `${json.baselines} baselines published from ${json.learnings} learnings; ${json.suppressed} groups below the anonymity threshold.` });
        router.refresh();
      }}
    >
      {busy ? "Aggregating" : "Run aggregation"}
    </Button>
  );
}
