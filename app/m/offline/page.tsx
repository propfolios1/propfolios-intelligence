import Link from "next/link";
import { MCard, MTitle } from "@/components/mobile/ui";

export default function MobileOffline() {
  return (
    <>
      <MTitle>No connection</MTitle>
      <MCard>
        <p className="text-[15px] text-ink-700">This screen has not been saved for offline use yet. Today, leads, listings, deals, commissions and notifications open offline once they have been viewed with a connection.</p>
        <Link href="/m/dashboard" className="mt-4 inline-block text-[14px] text-navy-900">
          Open Today
        </Link>
      </MCard>
    </>
  );
}
