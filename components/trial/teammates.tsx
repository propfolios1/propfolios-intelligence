"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { post } from "@/components/commission/post";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { toast } from "@/components/ui/toaster";

export function InviteTeammates({ remaining }: { remaining: number }) {
  const router = useRouter();
  const [emails, setEmails] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  if (remaining <= 0) return <p className="text-ui text-ink-500">All three trial seats are taken. Upgrade to invite more of the team.</p>;
  return (
    <form
      className="flex flex-col gap-3 sm:flex-row"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const r = await post("/api/trial/teammates", { emails: emails.split(/[\s,;]+/).filter(Boolean) }, { fail: "Invitations not sent" });
        setBusy(false);
        if (r) {
          toast.success(`${r.invited.length} ${r.invited.length === 1 ? "teammate" : "teammates"} invited`, { description: `${r.remaining} trial ${r.remaining === 1 ? "seat" : "seats"} left.` });
          setEmails("");
          router.refresh();
        }
      }}
    >
      <Input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="colleague@yourfirm.com, another@yourfirm.com" aria-label="Teammate email addresses" className="flex-1" />
      <Button type="submit" variant="secondary" disabled={busy || !emails.trim()}>
        {busy ? "Inviting" : `Invite, ${remaining} left`}
      </Button>
    </form>
  );
}
