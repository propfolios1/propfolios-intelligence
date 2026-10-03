"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "@/components/ui/toaster";

/** Posts one deal action and refreshes the page; returns the JSON result. */
export function useDealAction(dealId: string) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);
  // The third argument (a success message) is accepted for compatibility; outcomes show in the page itself, so no toast is raised.
  const run = async (action: string, body: Record<string, unknown>, _done?: string) => {
    void _done;
    setBusy(action);
    const res = await fetch(`/api/deals/${dealId}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      toast.error("Not completed", { description: json.error });
      return null;
    }
    router.refresh();
    return json;
  };
  return { run, busy };
}
