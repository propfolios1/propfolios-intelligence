"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function SeedButton() {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "confirm" | "busy">("idle");
  if (state === "confirm")
    return (
      <span className="flex flex-wrap items-center gap-3">
        <span className="text-small text-ink-700">This deletes all mandates, memos and edits and restores the demonstration dataset.</span>
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            setState("busy");
            const r = await fetch("/api/admin/reseed", { method: "POST" });
            setState("idle");
            if (r.ok) toast.success("Demonstration data restored");
            else toast.error("Reset failed");
            router.refresh();
          }}
        >
          Reset data
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setState("idle")}>
          Cancel
        </Button>
      </span>
    );
  return (
    <Button variant="destructive" disabled={state === "busy"} onClick={() => setState("confirm")}>
      {state === "busy" ? "Resetting" : "Reset to seed data"}
    </Button>
  );
}
