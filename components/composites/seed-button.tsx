"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/primitives/button";

export function SeedButton() {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "confirm" | "busy" | "done">("idle");
  if (state === "confirm")
    return (
      <span className="flex items-center gap-3">
        <span className="text-small text-ink-2">Discard agent output and edits?</span>
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            setState("busy");
            const r = await fetch("/api/admin/seed", { method: "POST" });
            setState(r.ok ? "done" : "idle");
            router.refresh();
          }}
        >
          Reset
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setState("idle")}>
          Cancel
        </Button>
      </span>
    );
  return (
    <Button variant="destructive" size="sm" disabled={state === "busy"} onClick={() => setState("confirm")}>
      {state === "busy" ? "Resetting" : state === "done" ? "Reset. Run again" : "Reset to seed data"}
    </Button>
  );
}
