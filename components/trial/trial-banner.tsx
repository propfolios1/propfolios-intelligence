import Link from "next/link";
import { getDb } from "@/db";
import { trialStatus } from "@/lib/trial/status";

/** Shown on every page of a trial workspace: days remaining, or the read-only notice. */
export async function TrialBanner({ tenantId, admin }: { tenantId: string; admin: boolean }) {
  const t = await trialStatus(await getDb(), tenantId).catch(() => null);
  if (!t || t.state === "purged") return null;
  const readOnly = t.state === "read_only";
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 border-b px-6 py-2 text-small md:px-12 xl:px-20 ${readOnly ? "border-gold-500/40 bg-gold-100 text-ink-900" : "border-hairline bg-navy-50 text-ink-700"}`} role="status" data-no-print>
      <span>
        {readOnly ? (
          <>The trial has ended. The workspace is read-only until you upgrade; nothing has been deleted, and it is kept until {t.readOnlyEndsAt.toISOString().slice(0, 10)}.</>
        ) : (
          <>
            <span className="num text-ink-900">{t.daysRemaining}</span> {t.daysRemaining === 1 ? "day" : "days"} remaining in your trial. Every record you add stays when you upgrade.
          </>
        )}
      </span>
      {admin ? (
        <Link href="/admin/upgrade" className="font-medium text-navy-900 underline decoration-navy-900/30 underline-offset-4 hover:decoration-navy-900">
          Upgrade
        </Link>
      ) : (
        <span className="text-ink-500">Your administrator can upgrade.</span>
      )}
    </div>
  );
}
