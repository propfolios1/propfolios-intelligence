"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function ClientActions({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  async function generate() {
    setBusy(true);
    const res = await fetch("/api/recommendations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Recommendations not generated", { description: json.error });
    toast.success(`${json.created} recommendations added`, { description: "The client sees them in their portal." });
    router.refresh();
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" onClick={generate} disabled={busy}>
        {busy ? "Recommender working" : "Generate recommendations"}
      </Button>
      <Button variant="secondary" asChild>
        <a href={`/api/demo/persona?as=analyst&client=${clientId}&to=/client/portfolio`}>Preview client portal</a>
      </Button>
      <Button asChild>
        <Link href={`/analyst/mandates/new?client=${clientId}`}>Create mandate</Link>
      </Button>
    </div>
  );
}
