"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function RunNow({ job, label, allowed }: { job: string; label: string; allowed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  if (!allowed) return <span className="text-[12px] text-ink-500">Platform administrators</span>;
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const r = await post(`/api/admin/jobs/${job}`, {}, { fail: `${label} did not start` });
        setBusy(false);
        if (r) {
          if (r.run.status === "failed") toast.error(`${label} failed`, { description: r.run.error });
          else toast.success(`${label} ${r.run.status === "skipped" ? "skipped: an earlier run is in progress" : `finished in ${(r.run.durationMs / 1000).toFixed(1)} s`}`);
          router.refresh();
        }
      }}
    >
      {busy ? "Running" : "Run now"}
    </Button>
  );
}
