"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "./ui/button";

export function SeedButton() {
  const router = useRouter();
  const [state, setState] = React.useState<"idle" | "busy" | "done">("idle");
  return (
    <Button
      variant="danger"
      size="sm"
      disabled={state === "busy"}
      onClick={async () => {
        if (!confirm("Reset all agent outputs, stage moves and memo edits to seed data?")) return;
        setState("busy");
        await fetch("/api/admin/seed", { method: "POST" });
        setState("done");
        router.refresh();
      }}
    >
      <RotateCcw /> {state === "busy" ? "Resetting…" : state === "done" ? "Reset complete" : "Reset to seed data"}
    </Button>
  );
}
