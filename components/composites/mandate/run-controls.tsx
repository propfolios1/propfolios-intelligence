"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toaster";
import { AUTOMATED_STAGES, STAGE_LABEL } from "@/lib/domain";
import { useLive } from "./live-mandate";

export function RunControls({ mandateId, reference, memoId, memoStatus, canDelete }: { mandateId: string; reference: string; memoId: string | null; memoStatus: string | null; canDelete: boolean }) {
  const { status, running, timeline, run } = useLive();
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const failed = timeline.some((t) => t.status === "failed");
  const automated = AUTOMATED_STAGES.includes(status);

  async function approve() {
    if (!memoId) return;
    setBusy(true);
    const res = await fetch(`/api/memos/${memoId}/approve`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deliver: true }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return void toast.error("Not approved", { description: json.error });
    toast.success(`${reference} delivered`, { description: "The memo is filed in the client's documents." });
    router.refresh();
  }

  async function remove() {
    const res = await fetch(`/api/mandates/${mandateId}`, { method: "DELETE" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return void toast.error("Not deleted", { description: json.error });
    }
    toast.success(`${reference} deleted`);
    router.push("/analyst/mandates");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {automated && !running && (
        <Button
          onClick={async () => {
            setBusy(true);
            await run();
            setBusy(false);
          }}
          disabled={busy}
        >
          {status === "INTAKE" ? "Run agents" : failed ? "Retry stage" : "Resume agents"}
        </Button>
      )}
      {running && (
        <Button disabled variant="secondary">
          Agents working
        </Button>
      )}
      {status === "REVIEW" && memoId && (
        <Button onClick={approve} disabled={busy}>
          Approve and deliver
        </Button>
      )}
      {memoId && (
        <Button variant="secondary" asChild>
          <a href={`/api/memos/${memoId}/export`} target="_blank" rel="noreferrer">
            {memoStatus === "delivered" ? "Download memo" : "Export PDF"}
          </a>
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" aria-label="More actions">
            More <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Re-run from stage</DropdownMenuLabel>
          {AUTOMATED_STAGES.filter((s) => s !== "INTAKE").map((s) => (
            <DropdownMenuItem key={s} disabled={running} onSelect={() => void run(s)}>
              {STAGE_LABEL[s]}
            </DropdownMenuItem>
          ))}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setConfirmDelete(true)}>
                Delete mandate
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogTitle className="font-display text-card text-navy-900">Delete {reference}?</DialogTitle>
          <DialogDescription className="mt-2 text-ui text-ink-700">The research, simulation, debate and memo are deleted with it. The audit log keeps a record of the deletion.</DialogDescription>
          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove}>
              Delete mandate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
